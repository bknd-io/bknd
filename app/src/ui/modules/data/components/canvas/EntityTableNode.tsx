import { Handle, type Node, type NodeProps, Position, useReactFlow } from "@xyflow/react";

import type { TAppDataEntity } from "data/data-schema";
import { useEffect, useState } from "react";
import { TbBolt, TbDiamonds, TbKey } from "react-icons/tb";
import { twMerge } from "tailwind-merge";
import { DefaultNode } from "ui/components/canvas/components/nodes/DefaultNode";
import { useTheme } from "ui/client/use-theme";
import { useNavigate } from "ui/lib/routes";
import type { TCanvasEntity, TCanvasEntityField } from "./DataSchemaCanvas";

export type TableProps = {
   name: string;
   type?: string;
   fields: TCanvasEntityField[];
};

function NodeComponent(props: NodeProps<Node<TCanvasEntity>>) {
   const { data } = props;
   const fields = props.data.fields ?? {};
   const field_count = Object.keys(fields).length;

   return (
      <DefaultNode selected={props.selected}>
         <DefaultNode.Header label={data.label} />
         <div>
            {Object.entries(fields).map(([name, field], index) => (
               <TableRow
                  key={index}
                  field={field}
                  table={data.label}
                  index={index}
                  last={field_count === index + 1}
                  selected={props.selected && ["relation", "primary"].includes(field.type)}
               />
            ))}
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
   selected,
}: {
   field: TCanvasEntityField;
   table: string;
   index: number;
   last?: boolean;
   selected?: boolean;
   onHover?: (hovered: boolean) => void;
}) => {
   const [navigate] = useNavigate();
   const handleTop = HEIGHTS.header + HEIGHTS.row * index + HEIGHTS.row / 2;
   const handles = true;
   const handleId = `${table}:${field.name}`;

   return (
      <div
         className={twMerge(
            "flex flex-row w-full justify-between font-mono py-1.5 px-2.5 border-b border-primary/15 border-l border-r cursor-pointer",
            last && "rounded-bl-lg rounded-br-lg",
            selected && "bg-primary/5",
            "hover:bg-primary/5",
         )}
         onClick={() => navigate(`/entity/${table}/fields/${field.name}`)}
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
            {field.type === "primary" && <TbKey className="text-yellow-700" />}
            {field.type === "relation" && <TbDiamonds className="text-sky-700" />}
         </div>
         <div className="flex flex-grow items-center gap-1">
            <span className={field.config?.required ? "font-bold" : "opacity-90"}>
               {field.name}
            </span>{" "}
            {field.indexed && <TbBolt className="text-warning-foreground/50" />}
         </div>
         <div className="flex opacity-60">{field.type}</div>

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
