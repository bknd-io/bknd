import { isTypeSchema } from "ui/components/form/json-schema-form/utils";
import { AnyOfField } from "./AnyOfField";
import { Field } from "./Field";
import { FieldWrapper, type FieldwrapperProps } from "./FieldWrapper";
import { type JSONSchema, useDerivedFieldContext } from "./Form";

export type ObjectFieldProps = {
   path?: string;
   label?: string | false;
   wrapperProps?: Partial<FieldwrapperProps>;
};

export const ObjectField = ({ path = "", label: _label, wrapperProps = {} }: ObjectFieldProps) => {
   const { schema } = useDerivedFieldContext(path);
   if (!isTypeSchema(schema)) return `ObjectField "${path}": no schema`;
   const properties = Object.entries(schema.properties ?? {}) as [string, JSONSchema][];

   return (
      <FieldWrapper
         name={path}
         schema={{ ...schema, description: undefined }}
         wrapper="fieldset"
         errorPlacement="top"
         {...wrapperProps}
      >
         {properties.length === 0 ? (
            <ObjectJsonField path={path} />
         ) : (
            properties.map(([prop, schema]) => {
               const name = [path, prop].filter(Boolean).join(".");
               if (typeof schema === "undefined" || typeof schema === "boolean") return;

               if (schema.anyOf || schema.oneOf) {
                  return <AnyOfField key={name} path={name} />;
               }

               return <Field key={name} name={name} />;
            })
         )}
      </FieldWrapper>
   );
};

export const ObjectJsonField = ({ path }: { path: string }) => {
   const { value } = useFormValue(path);
   const { setValue, path: absolutePath } = useDerivedFieldContext(path);
   return <JsonEditor value={value} onChange={(value) => setValue(absolutePath, value)} />;
};
