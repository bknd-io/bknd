import { IconBug } from "@tabler/icons-react";
import type { JsonSchema } from "json-schema-library";
import { Children, type ReactElement, type ReactNode, cloneElement, isValidElement } from "react";
import { IconButton } from "ui/components/buttons/IconButton";
import { JsonViewer } from "ui/components/code/JsonViewer";
import * as Formy from "ui/components/form/Formy";
import {
   useFormContext,
   useFormError,
   useFormValue,
} from "ui/components/form/json-schema-form/Form";
import { Popover } from "ui/components/overlay/Popover";
import { getLabel } from "./utils";

export type FieldwrapperProps = {
   name: string;
   label?: string | ReactNode | false;
   required?: boolean;
   schema?: JsonSchema;
   debug?: object | boolean;
   wrapper?: "group" | "fieldset";
   hidden?: boolean;
   children: ReactElement | ReactNode;
   errorPlacement?: "top" | "bottom";
   description?: string;
   descriptionPlacement?: "top" | "bottom";
   fieldId?: string;
};

export function FieldWrapper({
   name,
   label: _label,
   required,
   schema,
   wrapper,
   hidden,
   errorPlacement = "bottom",
   descriptionPlacement = "bottom",
   children,
   fieldId,
   ...props
}: FieldwrapperProps) {
   const errors = useFormError(name, { strict: true });
   const examples = schema?.examples || [];
   const examplesId = `${name}-examples`;
   const description = props?.description ?? schema?.description;
   const label = typeof _label !== "undefined" ? _label : schema ? getLabel(name, schema) : name;

   const Errors = errors.length > 0 && (
      <Formy.ErrorMessage>{errors.map((e) => e.message).join(", ")}</Formy.ErrorMessage>
   );

   const Description = description && (
      <Formy.Help className={descriptionPlacement === "top" ? "-mt-1 mb-1" : "mb-2"}>
         {description}
      </Formy.Help>
   );

   return (
      <Formy.Group
         error={errors.length > 0}
         as={wrapper === "fieldset" ? "fieldset" : "div"}
         className={hidden ? "hidden" : "relative"}
      >
         {errorPlacement === "top" && Errors}
         <FieldDebug name={name} schema={schema} required={required} />

         {label && (
            <Formy.Label
               as={wrapper === "fieldset" ? "legend" : "label"}
               htmlFor={fieldId}
               className="self-start"
            >
               {label} {required && <span className="font-medium opacity-30">*</span>}
            </Formy.Label>
         )}
         {descriptionPlacement === "top" && Description}

         <div className="flex flex-row gap-2">
            <div className="flex flex-1 flex-col gap-3">
               {Children.count(children) === 1 && isValidElement(children)
                  ? cloneElement(children, {
                       // @ts-ignore
                       list: examples.length > 0 ? examplesId : undefined,
                    })
                  : children}
               {examples.length > 0 && (
                  <datalist id={examplesId}>
                     {examples.map((e, i) => (
                        <option key={i} value={e as any} />
                     ))}
                  </datalist>
               )}
            </div>
         </div>
         {descriptionPlacement === "bottom" && Description}
         {errorPlacement === "bottom" && Errors}
      </Formy.Group>
   );
}

const FieldDebug = ({
   name,
   schema,
   required,
}: Pick<FieldwrapperProps, "name" | "schema" | "required">) => {
   const { options } = useFormContext();
   if (!options?.debug) return null;
   const { value } = useFormValue(name);
   const errors = useFormError(name, { strict: true });

   return (
      <div className="absolute top-0 right-0">
         <Popover
            overlayProps={{
               className: "max-w-none",
            }}
            position="bottom-end"
            target={({ toggle }) => (
               <JsonViewer
                  className="bg-background pr-3 text-sm"
                  json={{
                     name,
                     value,
                     required,
                     schema,
                     errors,
                  }}
                  expand={6}
               />
            )}
         >
            <IconButton Icon={IconBug} size="xs" className="opacity-30" />
         </Popover>
      </div>
   );
};
