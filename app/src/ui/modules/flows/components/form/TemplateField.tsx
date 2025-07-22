import type { FieldProps, FormContextType, RJSFSchema, StrictRJSFSchema } from "@rjsf/utils";
import { SimpleRenderer } from "core/template/SimpleRenderer";
import { ucFirst, ucFirstAll } from "bknd/utils";
import { useState } from "react";

const modes = ["field", "code"] as const;
type Mode = (typeof modes)[number];

export function TemplateField<
   T = any,
   S extends StrictRJSFSchema = RJSFSchema,
   F extends FormContextType = any,
>(props: FieldProps<T, S, F>) {
   const formData = props.formData;
   const hasMarkup = SimpleRenderer.hasMarkup(formData!);
   const [mode, setMode] = useState<Mode>(hasMarkup ? "code" : "field");
   const [values, setValues] = useState<Record<Mode, any>>({
      field: hasMarkup ? "" : formData,
      code: hasMarkup ? formData : "",
   });
   //console.log("TemplateField", props);
   const { SchemaField } = props.registry.fields;
   const { schema } = props;

   function handleModeSwitch(mode: Mode) {
      setMode(mode);
      props.onChange(values[mode]);
   }

   function onChange(value: any) {
      setValues({ ...values, [mode]: value });
      props.onChange(value);
   }

   let _schema: any = schema;
   if (!("anyOf" in schema)) {
      _schema = {
         anyOf: [schema, { type: "string" }],
      };
   }

   const [fieldSchema, codeSchema] = _schema.anyOf;
   const currentSchema = mode === "field" ? fieldSchema : codeSchema;
   const currentValue = values[mode];
   const uiSchema =
      mode === "field"
         ? { "ui:label": false }
         : {
              "ui:label": false,
              "ui:widget": "textarea",
              "ui:options": { rows: 1 },
           };

   return (
      <div className="flex flex-col gap-2 flex-grow">
         <label className="flex flex-row gap-2 w-full justify-between">
            {ucFirstAll(props.name)}

            <div className="flex flex-row gap-3 items-center">
               {modes.map((m) => (
                  <button
                     data-active={m === mode ? 1 : undefined}
                     className="leading-none text-sm pb-0.5 border-b border-b-transparent font-mono opacity-50 data-[active]:border-b-primary/50 data-[active]:opacity-100"
                     role="button"
                     key={m}
                     onClick={() => handleModeSwitch(m)}
                  >
                     {ucFirst(m)}
                  </button>
               ))}
            </div>
         </label>
         <div className="flex flex-col flex-grow items-stretch justify-stretch">
            {/* @ts-ignore */}
            <SchemaField
               uiSchema={uiSchema}
               schema={currentSchema}
               registry={props.registry}
               idSchema={props.idSchema}
               onFocus={props.onFocus}
               onBlur={props.onBlur}
               formData={currentValue}
               onChange={onChange}
               disabled={props.disabled}
               readonly={props.readonly}
               required={props.required}
               autofocus={props.autofocus}
               rawErrors={props.rawErrors}
               name={props.name}
            />
         </div>
      </div>
   );
}
