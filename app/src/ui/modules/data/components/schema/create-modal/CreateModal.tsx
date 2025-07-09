import type { ModalProps } from "@mantine/core";
import type { ContextModalProps } from "@mantine/modals";
import { useState } from "react";
import { type Modal2Ref, ModalBody, ModalFooter, ModalTitle } from "ui/components/modal/Modal2";
import { Step, Steps, useStepContext } from "ui/components/steps/Steps";
import { StepCreate } from "ui/modules/data/components/schema/create-modal/step.create";
import { StepEntity } from "./step.entity";
import { StepEntityFields } from "./step.entity.fields";
import { StepRelation } from "./step.relation";
import { StepSelect } from "./step.select";
import Templates from "./templates/register";
import type { TCreateModalSchema } from "./schema";

export type CreateModalRef = Modal2Ref;

export function CreateModal({
   context,
   id,
   innerProps: { initialPath = [], initialState },
}: ContextModalProps<{ initialPath?: string[]; initialState?: TCreateModalSchema }>) {
   const [path, setPath] = useState<string[]>(initialPath);

   function close() {
      context.closeModal(id);
   }

   return (
      <Steps path={path} lastBack={close} initialPath={initialPath} initialState={initialState}>
         <Step id="select">
            <ModalTitle path={["Create New"]} onClose={close} />
            <StepSelect />
         </Step>
         <Step id="entity" path={["action"]}>
            <ModalTitle path={["Create New", "Entity"]} onClose={close} />
            <StepEntity />
         </Step>
         <Step id="entity-fields" path={["action", "entity"]}>
            <ModalTitle path={["Create New", "Entity", "Fields"]} onClose={close} />
            <StepEntityFields />
         </Step>
         <Step id="relation" path={["action"]}>
            <ModalTitle path={["Create New", "Relation"]} onClose={close} />
            <StepRelation />
         </Step>
         <Step id="create" path={["action"]}>
            <ModalTitle path={["Create New", "Creation"]} onClose={close} />
            <StepCreate />
         </Step>

         {/* Templates */}
         {Templates.map(([Component, meta]) => (
            <Step key={meta.id} id={meta.id} path={["action"]}>
               <ModalTitle path={["Create New", "Template", meta.title]} onClose={close} />
               <Component />
            </Step>
         ))}
      </Steps>
   );
}
CreateModal.defaultTitle = undefined;
CreateModal.modalProps = {
   withCloseButton: false,
   size: "xl",
   padding: 0,
} satisfies Partial<ModalProps>;

export { ModalBody, ModalFooter, ModalTitle, useStepContext };
