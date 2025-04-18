import type { ModalProps } from "@mantine/core";
import type { ContextModalProps } from "@mantine/modals";
import { type Static, StringEnum, StringIdentifier } from "core/utils";
import { entitiesSchema, fieldsSchema, relationsSchema } from "data/data-schema";
import { useState } from "react";
import { type Modal2Ref, ModalBody, ModalFooter, ModalTitle } from "ui/components/modal/Modal2";
import { Step, Steps, useStepContext } from "ui/components/steps/Steps";
import { StepCreate } from "ui/modules/data/components/schema/create-modal/step.create";
import { StepEntity } from "./step.entity";
import { StepEntityFields } from "./step.entity.fields";
import { StepRelation } from "./step.relation";
import { StepSelect } from "./step.select";
import Templates from "./templates/register";
import * as tbbox from "@sinclair/typebox";
const { Type } = tbbox;

export type CreateModalRef = Modal2Ref;

export const ModalActions = ["entity", "relation", "media"] as const;

export const entitySchema = Type.Composite([
   Type.Object({
      name: StringIdentifier,
   }),
   entitiesSchema,
]);

const schemaAction = Type.Union([
   StringEnum(["entity", "relation", "media"]),
   Type.String({ pattern: "^template-" }),
]);
export type TSchemaAction = Static<typeof schemaAction>;

const createFieldSchema = Type.Object({
   entity: StringIdentifier,
   name: StringIdentifier,
   field: Type.Array(fieldsSchema),
});
export type TFieldCreate = Static<typeof createFieldSchema>;

const createModalSchema = Type.Object(
   {
      action: schemaAction,
      initial: Type.Optional(Type.Any()),
      entities: Type.Optional(
         Type.Object({
            create: Type.Optional(Type.Array(entitySchema)),
         }),
      ),
      relations: Type.Optional(
         Type.Object({
            create: Type.Optional(Type.Array(Type.Union(relationsSchema))),
         }),
      ),
      fields: Type.Optional(
         Type.Object({
            create: Type.Optional(Type.Array(createFieldSchema)),
         }),
      ),
   },
   {
      additionalProperties: false,
   },
);
export type TCreateModalSchema = Static<typeof createModalSchema>;

export function CreateModal({
   context,
   id,
   innerProps: { initialPath = [], initialState },
}: ContextModalProps<{ initialPath?: string[]; initialState?: TCreateModalSchema }>) {
   const [path, setPath] = useState<string[]>(initialPath);
   console.log("...", initialPath, initialState);

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

export { ModalBody, ModalFooter, ModalTitle, useStepContext, relationsSchema };
