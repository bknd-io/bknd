import { useDisclosure, useFocusTrap } from "@mantine/hooks";
import { omit } from "lodash-es";
import { useRef, useState } from "react";
import { useBknd } from "ui/client/BkndProvider";
import { Button } from "ui/components/buttons/Button";
import * as Formy from "ui/components/form/Formy";
import { JsonSchemaForm, type JsonSchemaFormRef } from "ui/components/form/json-schema";
import { Dropdown } from "ui/components/overlay/Dropdown";
import { Modal } from "ui/components/overlay/Modal";
import { useLocation } from "wouter";
import type { s } from "bknd/utils";

export type SettingsNewModalProps = {
   schema: s.ObjectSchema;
   uiSchema?: object;
   anyOfValues?: Record<string, { label: string; icon?: any }>;
   path: string[];
   prefixPath: string;
   generateKey?: string | ((formData: any) => string);
};

export const SettingNewModal = ({
   schema,
   uiSchema = {},
   anyOfValues,
   path,
   prefixPath,
   generateKey,
}: SettingsNewModalProps) => {
   const [location, navigate] = useLocation();
   const [formSchema, setFormSchema] = useState(schema);
   const [submitting, setSubmitting] = useState(false);
   const { actions } = useBknd();
   const [opened, { open, close }] = useDisclosure(false);
   const isGeneratedKey = generateKey !== undefined;
   const isStaticGeneratedKey = typeof generateKey === "string";
   const [newKey, setNewKey] = useState(isStaticGeneratedKey ? generateKey : "");
   const focusTrap = useFocusTrap(!isGeneratedKey);
   const formRef = useRef<JsonSchemaFormRef>(null);
   const isAnyOf = "anyOf" in schema;

   function handleFormChange(data) {
      if (generateKey && typeof generateKey === "function") {
         handleKeyNameChange({
            target: {
               value: generateKey(data),
            },
         });
      }
      console.log("form change", data);
   }

   function handleKeyNameChange(e) {
      const v = String(e.target.value);
      if (v.length > 0 && !/^[a-zA-Z_][a-zA-Z0-9_ ]*$/.test(v)) {
         console.log("no match", v);
         return;
      }
      setNewKey(v.toLowerCase().replace(/ /g, "_").replace(/__+/g, "_"));
   }

   async function handleSave() {
      if (formRef.current?.validateForm()) {
         setSubmitting(true);
         const data = formRef.current?.formData();
         const [module, ...restOfPath] = path;
         const addPath = [...restOfPath, newKey].join(".");
         if (await actions.add(module as any, addPath, data)) {
            setTimeout(() => {
               navigate(prefixPath + newKey, {
                  replace: true,
               });
            }, 500);
         } else {
            setSubmitting(false);
         }
      }
      console.log("valid?", formRef.current?.validateForm());
      console.log("data", newKey, formRef.current?.formData());
   }

   const anyOfItems = isAnyOf
      ? (schema.anyOf as any[])!.map((item) => {
           const key = item.title;
           const label = anyOfValues?.[key]?.label || key;
           const icon = anyOfValues?.[key]?.icon;

           return {
              label,
              icon,
              onClick: () => {
                 setFormSchema(item);
                 open();
              },
           };
        })
      : [];

   return (
      <>
         <div className="flex flex-row">
            {isAnyOf ? (
               <Dropdown position="top-start" items={anyOfItems} itemsClassName="gap-3">
                  <Button>Add new</Button>
               </Dropdown>
            ) : (
               <Button onClick={open}>Add new</Button>
            )}
         </div>

         <Modal
            open={opened}
            allowBackdropClose={false}
            onClose={close}
            className="min-w-96 w-6/12 mt-[30px] mb-[20px]"
            stickToTop
         >
            <div
               className="border border-muted rounded-lg flex flex-col overflow-y-scroll font-normal"
               style={{ maxHeight: "calc(100dvh - 100px)" }}
            >
               <div className="bg-muted py-2 px-4 text-primary/70 font-mono flex flex-row gap-2 items-center">
                  {[...path, newKey].join(".")}
               </div>
               <div className="flex flex-row gap-10 sticky top-0 bg-background z-10 p-4 border-b border-muted">
                  <div className="flex flex-row flex-grow items-center relative">
                     <Formy.Input
                        ref={focusTrap}
                        className="w-full"
                        placeholder="New unique key..."
                        onChange={handleKeyNameChange}
                        value={newKey}
                        disabled={isGeneratedKey}
                     />
                     {isGeneratedKey && (
                        <div className="absolute h-full flex items-center z-10 right-3.5 top-0 bottom-0 font-mono font-sm opacity-50">
                           generated
                        </div>
                     )}
                  </div>
                  <div className="flex flex-row gap-2">
                     <Button onClick={close} disabled={submitting}>
                        Cancel
                     </Button>
                     <Button
                        variant="primary"
                        onClick={handleSave}
                        disabled={submitting || newKey.length === 0}
                     >
                        Create
                     </Button>
                  </div>
               </div>
               <div className="flex flex-col p-4">
                  <JsonSchemaForm
                     ref={formRef}
                     /* readonly={!editing} */
                     schema={omit(formSchema, ["title"])}
                     uiSchema={uiSchema}
                     onChange={handleFormChange}
                     className="legacy hide-required-mark fieldset-alternative mute-root"
                  />
               </div>
            </div>
         </Modal>
      </>
   );
};
