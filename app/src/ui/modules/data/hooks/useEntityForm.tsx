import { useForm } from "@tanstack/react-form";
import type { Entity, EntityData } from "bknd";
import { getChangeSet, getDefaultValues } from "data/helper";

type EntityFormProps = {
   action: "create" | "update";
   entity: Entity;
   initialData?: EntityData | null;
   onSubmitted?: (changeSet?: EntityData) => Promise<void>;
};

export function useEntityForm({
   action = "update",
   entity,
   initialData,
   onSubmitted,
}: EntityFormProps) {
   const data = initialData ?? {};
   // @todo: check if virtual must be filtered
   const fields = entity.getFillableFields(action, true);

   // filter defaultValues to only contain fillable fields
   const defaultValues = getDefaultValues(fields, data);
   //console.log("useEntityForm", { data, defaultValues });

   const Form = useForm({
      defaultValues,
      validators: {
         onSubmitAsync: async ({ value }): Promise<any> => {
            try {
               //console.log("validating", value, entity.isValidData(value, action));
               entity.isValidData(value, action, {
                  explain: true,
                  // unknown will later be removed in getChangeSet
                  ignoreUnknown: true,
               });
               return undefined;
            } catch (e) {
               //console.log("---validation error", e);
               return (e as Error).message;
            }
         },
      },
      onSubmit: async ({ value, formApi }) => {
         //console.log("onSubmit", value);
         if (!entity.isValidData(value, action)) {
            console.error("invalid data", value);
            return;
         }
         //await new Promise((resolve) => setTimeout(resolve, 1000));

         if (!data) return;
         const changeSet = getChangeSet(action, value, data, fields);
         //console.log("changesSet", action, changeSet, { data });

         // only submit change set if there were changes
         await onSubmitted?.(Object.keys(changeSet).length === 0 ? undefined : changeSet);
      },
   });

   async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault();
      e.stopPropagation();
      //console.log("handlesubmit");
      void Form.handleSubmit();
   }

   return { Form, handleSubmit, fields, action, values: defaultValues, initialData };
}
