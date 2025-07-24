import type { EntityData } from "bknd";
import type { JsonSchemaField } from "data/fields";
import * as Formy from "ui/components/form/Formy";
import { FieldLabel } from "ui/components/form/Formy";
import { JsonSchemaForm } from "ui/components/form/json-schema";
import type { TFieldApi } from "ui/modules/data/components/EntityForm";

export function EntityJsonSchemaFormField({
   fieldApi,
   field,
   data,
   disabled,
   ...props
}: {
   fieldApi: TFieldApi;
   field: JsonSchemaField;
   data?: EntityData;
   disabled?: boolean;
   tabIndex?: number;
}) {
   function handleChange(value: any) {
      if (disabled) return;
      fieldApi.setValue(value);
   }

   const formData = data?.[field.name];
   //console.log("formData", { disabled, formData });

   return (
      <Formy.Group>
         <FieldLabel htmlFor={fieldApi.name} field={field} />
         <div
            data-disabled={disabled ? 1 : undefined}
            className="data-[disabled]:opacity-70 data-[disabled]:pointer-events-none"
         >
            <JsonSchemaForm
               schema={field.getJsonSchema()}
               onChange={handleChange}
               direction="horizontal"
               formData={formData}
               uiSchema={{
                  "ui:globalOptions": { flexDirection: "row" },
                  ...field.getJsonUiSchema(),
               }}
            />
         </div>
      </Formy.Group>
   );
}
