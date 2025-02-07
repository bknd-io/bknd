import { Popover } from "@mantine/core";
import { IconBug } from "@tabler/icons-react";
import type { JsonSchema } from "json-schema-library";
import { Children, type ReactElement, type ReactNode, cloneElement, isValidElement } from "react";
import { IconButton } from "ui/components/buttons/IconButton";
import { JsonViewer } from "ui/components/code/JsonViewer";
import * as Formy from "ui/components/form/Formy";
import { useFormError } from "ui/components/form/json-schema-form/Form";
import { getLabel } from "./utils";

export type FieldwrapperProps = {
   name: string;
   label?: string | false;
   required?: boolean;
   schema?: JsonSchema;
   debug?: object | boolean;
   wrapper?: "group" | "fieldset";
   hidden?: boolean;
   children: ReactElement | ReactNode;
};

export function FieldWrapper({
   name,
   label: _label,
   required,
   schema,
   debug,
   wrapper,
   hidden,
   children
}: FieldwrapperProps) {
   const errors = useFormError(name, { strict: true });
   const examples = schema?.examples || [];
   const examplesId = `${name}-examples`;
   const description = schema?.description;
   const label = typeof _label !== "undefined" ? _label : schema ? getLabel(name, schema) : name;

   return (
      <Formy.Group
         error={errors.length > 0}
         as={wrapper === "fieldset" ? "fieldset" : "div"}
         className={hidden ? "hidden" : "relative"}
      >
         {debug && (
            <div className="absolute right-0 top-0">
               {/* @todo: use radix */}
               <Popover>
                  <Popover.Target>
                     <IconButton Icon={IconBug} size="xs" className="opacity-30" />
                  </Popover.Target>
                  <Popover.Dropdown>
                     <JsonViewer
                        json={{
                           ...(typeof debug === "object" ? debug : {}),
                           name,
                           required,
                           schema,
                           errors
                        }}
                        expand={6}
                        className="p-0"
                     />
                  </Popover.Dropdown>
               </Popover>
            </div>
         )}

         {label && (
            <Formy.Label
               as={wrapper === "fieldset" ? "legend" : "label"}
               htmlFor={name}
               className="self-start"
            >
               {label} {required && <span className="font-medium opacity-30">*</span>}
            </Formy.Label>
         )}
         <div className="flex flex-row gap-2">
            <div className="flex flex-1 flex-col gap-3">
               {Children.count(children) === 1 && isValidElement(children)
                  ? cloneElement(children, {
                       // @ts-ignore
                       list: examples.length > 0 ? examplesId : undefined
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
         {description && <Formy.Help>{description}</Formy.Help>}
         {errors.length > 0 && (
            <Formy.ErrorMessage>{errors.map((e) => e.message).join(", ")}</Formy.ErrorMessage>
         )}
      </Formy.Group>
   );
}
