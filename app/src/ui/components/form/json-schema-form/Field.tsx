import type { JsonSchema } from "json-schema-library";
import {
   type ChangeEvent,
   type ComponentPropsWithoutRef,
   type ElementType,
   type ReactNode,
   useEffect,
   useId,
} from "react";
import ErrorBoundary from "ui/components/display/ErrorBoundary";
import * as Formy from "ui/components/form/Formy";
import { useEvent } from "ui/hooks/use-event";
import { ArrayField } from "./ArrayField";
import { FieldWrapper, type FieldwrapperProps } from "./FieldWrapper";
import { useDerivedFieldContext, useFormValue } from "./Form";
import { ObjectField } from "./ObjectField";
import { coerce, firstDefined, isType, isTypeSchema } from "./utils";

export type FieldProps = {
   onChange?: (e: ChangeEvent<any>) => void;
   placeholder?: string;
   disabled?: boolean;
   inputProps?: Partial<FieldComponentProps>;
} & Omit<FieldwrapperProps, "children" | "schema">;

export const Field = (props: FieldProps) => {
   return (
      <ErrorBoundary fallback={fieldErrorBoundary(props)}>
         <FieldImpl {...props} />
      </ErrorBoundary>
   );
};

export const HiddenField = ({
   as = "div",
   className,
   ...props
}: FieldProps & { as?: ElementType; className?: string }) => {
   const Component = as;
   return (
      <Component className={[className, "hidden"].filter(Boolean).join(" ")}>
         <Field {...props} />
      </Component>
   );
};

const fieldErrorBoundary =
   ({ name }: FieldProps) =>
   ({ error }: { error: Error }) => (
      <Pre>
         Field "{name}" error: {error.message}
      </Pre>
   );

const FieldImpl = ({
   name,
   onChange,
   placeholder,
   required: _required,
   inputProps,
   ...props
}: FieldProps) => {
   const { path, setValue, schema, ...ctx } = useDerivedFieldContext(name);
   const id = `${name}-${useId()}`;
   const required = typeof _required === "boolean" ? _required : ctx.required;

   if (!schema)
      return (
         <Pre>
            [Field] {path} has no schema ({JSON.stringify(schema)})
         </Pre>
      );

   if (isType(schema.type, "object")) {
      return <ObjectField path={name} />;
   }

   if (isType(schema.type, "array")) {
      return <ArrayField path={name} />;
   }

   // account for `defaultValue`
   // like <Field name="name" inputProps={{ defaultValue: "oauth" }} />
   useEffect(() => {
      if (inputProps?.defaultValue) {
         setValue(path, inputProps.defaultValue);
      }
   }, [inputProps?.defaultValue]);

   const disabled = firstDefined(
      inputProps?.disabled,
      props.disabled,
      schema.readOnly,
      "const" in schema,
      false,
   );

   const handleChange = useEvent((e: ChangeEvent<HTMLInputElement>) => {
      const value = coerce(e.target.value, schema as any, { required });
      if (typeof value === "undefined" && !required && ctx.options?.keepEmpty !== true) {
         ctx.deleteValue(path);
      } else {
         setValue(path, value);
      }
   });

   return (
      <FieldWrapper name={name} required={required} schema={schema} fieldId={id} {...props}>
         <FieldComponent
            {...inputProps}
            id={id}
            schema={schema}
            name={name}
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            onChange={onChange ?? handleChange}
         />
      </FieldWrapper>
   );
};

export const Pre = ({ children }) => (
   <pre className="dark:bg-red-950 bg-red-100 rounded-md px-3 py-1.5 text-wrap whitespace-break-spaces  break-all">
      {children}
   </pre>
);

export type FieldComponentProps = {
   schema: JsonSchema;
   render?: (props: Omit<FieldComponentProps, "render">) => ReactNode;
   "data-testId"?: string;
} & ComponentPropsWithoutRef<"input">;

export const FieldComponent = ({ schema, render, ..._props }: FieldComponentProps) => {
   const { value } = useFormValue(_props.name!, { strict: true });
   if (!isTypeSchema(schema)) return null;
   const props = {
      ..._props,
      // allow override
      value: typeof _props.value !== "undefined" ? _props.value : value,
      placeholder:
         (_props.placeholder ?? typeof schema.default !== "undefined")
            ? String(schema.default)
            : "",
   };

   if (render) return render({ schema, ...props });

   if (schema.enum) {
      return <Formy.Select options={schema.enum} {...(props as any)} />;
   }

   if (isType(schema.type, ["number", "integer"])) {
      const additional = {
         min: schema.minimum,
         max: schema.maximum,
         step: schema.multipleOf,
      };

      return <Formy.Input type="number" {...props} value={props.value ?? ""} {...additional} />;
   }

   if (isType(schema.type, "boolean")) {
      return <Formy.Switch {...(props as any)} checked={value === true} />;
   }

   if (isType(schema.type, "string") && schema.format === "date-time") {
      const value = props.value ? new Date(props.value as string).toISOString().slice(0, 16) : "";
      return (
         <Formy.DateInput
            {...props}
            value={value}
            type="datetime-local"
            onChange={(e) => {
               const date = new Date(e.target.value);
               props.onChange?.({
                  // @ts-ignore
                  target: { value: date.toISOString() },
               });
            }}
         />
      );
   }

   if (isType(schema.type, "string") && schema.format === "date") {
      return <Formy.DateInput {...props} value={props.value ?? ""} />;
   }

   const additional = {
      maxLength: schema.maxLength,
      minLength: schema.minLength,
      pattern: schema.pattern,
   } as any;

   if (schema.format) {
      if (["password", "hidden", "url", "email", "tel"].includes(schema.format)) {
         additional.type = schema.format;
      }
   }

   return <Formy.TypeAwareInput {...props} value={props.value ?? ""} {...additional} />;
};
