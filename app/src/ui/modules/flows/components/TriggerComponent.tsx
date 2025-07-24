import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { transformObject } from "core/utils";
import { type Trigger, TriggerMap } from "flows";
import type { IconType } from "react-icons";
import { TbCircleLetterT } from "react-icons/tb";
import { JsonSchemaForm } from "ui/components/form/json-schema";
import { s } from "bknd/utils";

export type TaskComponentProps = NodeProps<Node<{ trigger: Trigger }>> & {
   Icon?: IconType;
   children?: React.ReactNode;
};

const triggerSchemas = Object.values(
   transformObject(TriggerMap, (trigger, name) =>
      s.object(
         {
            type: s.literal(name),
            config: trigger.cls.schema,
         },
         { title: String(name), additionalProperties: false },
      ),
   ),
);

export function TriggerComponent({
   children,
   Icon = TbCircleLetterT,
   ...props
}: TaskComponentProps) {
   const { trigger } = props.data;

   return (
      <>
         <div
            data-selected={props.selected ? 1 : undefined}
            className="flex flex-col rounded bg-background/80 border border-muted data-[selected]:bg-background data-[selected]:ring-2 ring-primary/40 w-[500px] cursor-auto"
         >
            <div className="flex flex-row gap-2 px-3 py-2 items-center justify-between drag-handle cursor-grab">
               <div className="flex flex-row gap-2 items-center">
                  <Icon size={18} />
                  <div className="font-medium">{trigger.type}</div>
               </div>
            </div>
            <div className="w-full h-px bg-primary/10" />
            <div className="flex flex-col gap-2 px-3 py-2">
               <JsonSchemaForm
                  className="legacy"
                  schema={s.anyOf(triggerSchemas)}
                  onChange={console.log}
                  formData={trigger}
                  {...props}
                  /*uiSchema={uiSchema}*/
                  /*fields={{ template: TemplateField }}*/
               />
            </div>
         </div>
         <Handle
            type="source"
            position={props.sourcePosition ?? Position.Bottom}
            isConnectable={props.isConnectable}
         />
      </>
   );
}
