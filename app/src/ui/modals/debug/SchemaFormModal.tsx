import { useRef, useState } from "react";
import { Button } from "ui/components/buttons/Button";
import {
   JsonSchemaForm,
   type JsonSchemaFormProps,
   type JsonSchemaFormRef,
} from "ui/components/form/json-schema";

import type { ContextModalProps } from "@mantine/modals";
import { Alert } from "ui/components/display/Alert";

type Props = JsonSchemaFormProps & {
   autoCloseAfterSubmit?: boolean;
   onSubmit?: (
      data: any,
      context: {
         close: () => void;
      },
   ) => void | Promise<void>;
};

export function SchemaFormModal({
   context,
   id,
   innerProps: { schema, uiSchema, onSubmit, autoCloseAfterSubmit },
}: ContextModalProps<Props>) {
   const [valid, setValid] = useState(false);
   const formRef = useRef<JsonSchemaFormRef>(null);
   const [submitting, setSubmitting] = useState(false);
   const was_submitted = useRef(false);
   const [error, setError] = useState<string>();

   function handleChange(data, isValid) {
      const valid = isValid();
      console.log("Data changed", data, valid);
      setValid(valid);
   }

   function handleClose() {
      context.closeModal(id);
   }

   async function handleSubmit() {
      was_submitted.current = true;
      if (!formRef.current?.validateForm()) {
         return;
      }

      setSubmitting(true);
      await onSubmit?.(formRef.current?.formData(), {
         close: handleClose,
         setError,
      });
      setSubmitting(false);

      if (autoCloseAfterSubmit !== false) {
         handleClose();
      }
   }

   return (
      <>
         {error && <Alert.Exception message={error} />}
         <div className="pt-3 pb-3 px-4 gap-4 flex flex-col">
            <JsonSchemaForm
               tagName="form"
               ref={formRef}
               schema={JSON.parse(JSON.stringify(schema))}
               uiSchema={uiSchema}
               className="legacy hide-required-mark fieldset-alternative mute-root"
               onChange={handleChange}
               onSubmit={handleSubmit}
            />
            <div className="flex flex-row justify-end gap-2">
               <Button onClick={handleClose}>Cancel</Button>
               <Button variant="primary" onClick={handleSubmit} disabled={!valid || submitting}>
                  Create
               </Button>
            </div>
         </div>
      </>
   );
}

SchemaFormModal.defaultTitle = "JSON Schema Form Modal";
SchemaFormModal.modalProps = {
   size: "md",
   classNames: {
      root: "bknd-admin",
      header: "!bg-lightest !py-3 px-5 !h-auto !min-h-px",
      content: "rounded-lg select-none",
      title: "!font-bold !text-md",
      body: "!p-0",
   },
};
