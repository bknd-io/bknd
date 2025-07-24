import { useDisclosure } from "@mantine/hooks";
import {
   IconAlignJustified,
   IconBox,
   IconCirclesRelation,
   IconInfoCircle,
} from "@tabler/icons-react";
import { ucFirst } from "core/utils";
import { useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import { useBknd } from "ui/client/bknd";
import { useBkndData } from "ui/client/schema/data/use-bknd-data";
import { IconButton, type IconType } from "ui/components/buttons/IconButton";
import { JsonViewer } from "ui/components/code/JsonViewer";
import { ModalBody, ModalFooter } from "ui/components/modal/Modal2";
import { useStepContext } from "ui/components/steps/Steps";
import type { TCreateModalSchema } from "ui/modules/data/components/schema/create-modal/schema";

type ActionItem = SummaryItemProps & {
   run: () => Promise<boolean>;
};

export function StepCreate() {
   const { stepBack, state, close } = useStepContext<TCreateModalSchema>();
   const [states, setStates] = useState<(boolean | string)[]>([]);
   const [submitting, setSubmitting] = useState(false);
   const $data = useBkndData();
   const b = useBknd();

   const items: ActionItem[] = [];
   if (state.entities?.create) {
      items.push(
         ...state.entities.create.map((entity) => ({
            action: "add",
            Icon: IconBox,
            type: "Entity",
            name: entity.name!,
            json: entity,
            run: async () => await $data.actions.entity.add(entity.name!, entity),
         })),
      );
   }
   if (state.fields?.create) {
      items.push(
         ...state.fields.create.map((field) => ({
            action: "add",
            Icon: IconAlignJustified,
            type: "Field",
            name: field.name,
            json: field,
            run: async () =>
               await $data.actions.entity
                  .patch(field.entity)
                  .fields.add(field.name, field.field as any),
         })),
      );
   }
   if (state.relations?.create) {
      items.push(
         ...state.relations.create.map((rel) => ({
            action: "add",
            Icon: IconCirclesRelation,
            type: "Relation",
            name: `${rel.source} -> ${rel.target} (${rel.type})`,
            json: rel,
            run: async () => await $data.actions.relations.add(rel),
         })),
      );
   }

   async function handleCreate() {
      setSubmitting(true);
      for (const item of items) {
         try {
            const res = await item.run();
            setStates((prev) => [...prev, res]);
            if (res !== true) {
               // make sure to break out
               break;
            }
         } catch (e) {
            setStates((prev) => [...prev, (e as any).message]);
         }
      }
   }

   useEffect(() => {
      console.log(
         "states",
         states,
         items,
         states.length,
         items.length,
         states.every((s) => s === true),
      );
      if (items.length === states.length && states.every((s) => s === true)) {
         b.actions.reload().then(close);
         //close();
      } else {
         setSubmitting(false);
      }
   }, [states]);

   return (
      <>
         <ModalBody>
            <div>This is what will be created. Please confirm by clicking "Next".</div>
            <div className="flex flex-col gap-1">
               {items.map((item, i) => (
                  <SummaryItem key={i} {...item} state={states[i]} />
               ))}
            </div>
         </ModalBody>
         <ModalFooter
            nextLabel="Create"
            next={{
               onClick: handleCreate,
               disabled: submitting,
            }}
            prev={{ onClick: stepBack, disabled: submitting }}
            debug={{ state }}
         />
      </>
   );
}

type SummaryItemProps = {
   Icon: IconType;
   action: "add" | string;
   type: string;
   name: string;
   json?: object;
   state?: boolean | string;
   initialExpanded?: boolean;
};

const SummaryItem: React.FC<SummaryItemProps> = ({
   Icon,
   type,
   name,
   json,
   state,
   action,
   initialExpanded = false,
}) => {
   const [expanded, handlers] = useDisclosure(initialExpanded);
   const error = typeof state !== "undefined" && state !== true;
   const done = state === true;

   return (
      <div
         className={twMerge(
            "flex flex-col border border-muted rounded bg-background mb-2",
            error && "bg-red-500/20",
            done && "bg-green-500/20",
         )}
      >
         <div className="flex flex-row gap-4 px-2 py-2 items-center">
            <div className="flex flex-row items-center p-1 bg-primary/5 rounded">
               <Icon className="w-6 h-6" />
            </div>
            <div className="flex flex-row flex-grow gap-5">
               <Desc type="action" name={action} />
               <Desc type="type" name={type} />
               <Desc type="name" name={name} />
            </div>
            {json && (
               <IconButton
                  Icon={IconInfoCircle}
                  variant={expanded ? "default" : "ghost"}
                  onClick={handlers.toggle}
               />
            )}
         </div>
         {json && expanded && (
            <div className="flex flex-col border-t border-t-muted">
               <JsonViewer json={json} expand={8} className="text-sm" />
            </div>
         )}
         {error && typeof state === "string" && <div className="text-sm text-red-500">{state}</div>}
      </div>
   );
};

const Desc = ({ type, name }) => (
   <div className="flex flex-row text-sm font-mono gap-2">
      <div className="opacity-50">{ucFirst(type)}</div>
      <div className="font-semibold">{name}</div>
   </div>
);
