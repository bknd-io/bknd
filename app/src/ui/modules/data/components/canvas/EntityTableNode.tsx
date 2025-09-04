import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";

import type { TAppDataEntity } from "data/data-schema";
import { useState } from "react";
import { TbDiamonds, TbKey, TbSettings } from "react-icons/tb";
import { twMerge } from "tailwind-merge";
import { DefaultNode } from "ui/components/canvas/components/nodes/DefaultNode";
import { isCustomIdField, getCustomHandlerInfo } from "../../utils/field-utils";

export type TableProps = {
   name: string;
   type?: string;
   fields: TableField[];
};
export type TableField = {
   name: string;
   type: string;
   primary?: boolean;
   foreign?: boolean;
   indexed?: boolean;
   customHandler?: boolean;
   format?: string;
};

function NodeComponent(props: NodeProps<Node<TAppDataEntity & { label: string }>>) {
   const [hovered, setHovered] = useState(false);
   const { data } = props;
   const fields = props.data.fields ?? {};
   const field_count = Object.keys(fields).length;

   return (
      <DefaultNode selected={props.selected}>
         <DefaultNode.Header label={data.label} />
         <div>
            {Object.entries(fields).map(([name, field], index) => {
               const customHandlerInfo = getCustomHandlerInfo(field);
               return (
                  <TableRow
                     key={index}
                     field={{
                        name,
                        ...field,
                        customHandler: customHandlerInfo.hasCustomHandler,
                        format: field.type === "primary" ? (field.config as any)?.format : undefined
                     }}
                     table={data.label}
                     index={index}
                     last={field_count === index + 1}
                  />
               );
            })}
         </div>
      </DefaultNode>
   );
}

const handleStyle = {
   background: "transparent",
   border: "none",
};
const TableRow = ({
   field,
   table,
   index,
   onHover,
   last,
}: {
   field: TableField;
   table: string;
   index: number;
   last?: boolean;
   onHover?: (hovered: boolean) => void;
}) => {
   const handleTop = HEIGHTS.header + HEIGHTS.row * index + HEIGHTS.row / 2;
   const handles = true;
   const handleId = `${table}:${field.name}`;

   return (
      <div
         className={twMerge(
            "flex flex-row w-full justify-between font-mono py-1.5 px-2.5 border-b border-primary/15 border-l border-r cursor-auto",
            last && "rounded-bl-lg rounded-br-lg",
            "hover:bg-primary/5",
         )}
      >
         {handles && (
            <Handle
               title={handleId}
               type="source"
               id={handleId}
               position={Position.Left}
               style={{ top: handleTop, left: 0, ...handleStyle }}
            />
         )}

         <div className="flex w-6 pr-1.5 justify-center items-center">
            {field.type === "primary" && !field.customHandler && <TbKey className="text-yellow-700" />}
            {field.type === "primary" && field.customHandler && (
               <div className="relative">
                  <TbKey className="text-yellow-700" />
                  <TbSettings className="absolute -top-1 -right-1 w-2.5 h-2.5 text-purple-600 bg-white rounded-full" />
               </div>
            )}
            {field.type === "relation" && <TbDiamonds className="text-sky-700" />}
         </div>
         <div className="flex flex-grow">{field.name}</div>
         <div className="flex opacity-60">
            {field.type === "primary" && field.customHandler ? (
               <span className="text-purple-600 font-medium">custom</span>
            ) : (
               field.type
            )}
         </div>

         {handles && (
            <Handle
               type="target"
               title={handleId}
               id={handleId}
               position={Position.Right}
               style={{ top: handleTop, right: -5, ...handleStyle }}
            />
         )}
      </div>
   );
};

export const HEIGHTS = {
   header: 30,
   row: 32.5,
};

export const EntityTableNode = {
   Component: NodeComponent,
   getSize: (data: TAppDataEntity) => {
      const fields = data.fields ?? {};
      const field_count = Object.keys(fields).length;
      return {
         width: 320,
         height: HEIGHTS.header + HEIGHTS.row * field_count,
      };
   },
};
