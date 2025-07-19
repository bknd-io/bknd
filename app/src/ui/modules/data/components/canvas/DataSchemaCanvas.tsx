import { MarkerType, type Node, Position, ReactFlowProvider, useReactFlow } from "@xyflow/react";
import type { AppDataConfig, TAppDataEntity, TAppDataField } from "data/data-schema";
import { useBknd } from "ui/client/BkndProvider";
import { Canvas, type CanvasProps } from "ui/components/canvas/Canvas";
import { layoutWithDagre } from "ui/components/canvas/layouts";
import { Panels } from "ui/components/canvas/panels";
import { EntityTableNode } from "./EntityTableNode";
import { useTheme } from "ui/client/use-theme";
import { useCallback } from "react";
import { mergeObject, transformObject } from "core/utils";

export interface TCanvasEntityField extends TAppDataField {
   name: string;
   indexed?: boolean;
}

export interface TCanvasEntity extends TAppDataEntity {
   label: string;
   fields: Record<string, TCanvasEntityField>;
   [key: string]: any;
}

function entitiesToNodes(
   entities: AppDataConfig["entities"],
   indices?: AppDataConfig["indices"],
): Node<TCanvasEntity>[] {
   const indexed_fields = Object.entries(indices ?? {}).flatMap(([, index]) => index.fields);

   return Object.entries(entities ?? {}).map(([name, entity]) => {
      return {
         id: name,
         data: {
            ...entity,
            label: name,
            fields: transformObject(entity.fields ?? {}, (f, name) => ({
               ...f,
               name,
               indexed: indexed_fields.includes(name),
            })),
         },
         type: "entity",
         dragHandle: ".drag-handle",
         position: { x: 0, y: 0 },
         sourcePosition: Position.Right,
         targetPosition: Position.Left,
      };
   });
}

function relationsToEdges(relations: AppDataConfig["relations"]) {
   return Object.entries(relations ?? {}).flatMap(([name, relation]) => {
      if (relation.type === "m:n") {
         const conn_table = `${relation.source}_${relation.target}`;
         return [
            {
               id: name,
               target: relation.source,
               source: conn_table,
               targetHandle: `${relation.source}:id`,
               sourceHandle: `${conn_table}:${relation.source}_id`,
            },
            {
               id: `${name}-2`,
               target: relation.target,
               source: conn_table,
               targetHandle: `${relation.target}:id`,
               sourceHandle: `${conn_table}:${relation.target}_id`,
            },
         ];
      }

      let sourceHandle = relation.source + `:${relation.target}`;
      if (relation.config?.mappedBy) {
         sourceHandle = `${relation.source}:${relation.config?.mappedBy}`;
      }
      if (relation.type !== "poly") {
         sourceHandle += "_id";
      }

      return {
         id: name,
         source: relation.source,
         target: relation.target,
         sourceHandle,
         targetHandle: relation.target + ":id",
      };
   });
}

const nodeTypes = {
   entity: EntityTableNode.Component,
} as const;

const getEdgeStyle = (theme: string) => ({
   stroke: theme === "light" ? "#ccc" : "#666",
});

const getMarkerEndStyle = (theme: string) => ({
   type: MarkerType.Arrow,
   width: 20,
   height: 20,
   color: theme === "light" ? "#aaa" : "#777",
});

export function DataSchemaCanvas() {
   const {
      config: { data },
   } = useBknd();
   const { theme } = useTheme();
   const nodes = entitiesToNodes(data.entities, data.indices);
   console.log(nodes);
   const edges = relationsToEdges(data.relations).map((e) => ({
      ...e,
      style: getEdgeStyle(theme),
      type: "smoothstep",
      markerEnd: getMarkerEndStyle(theme),
   }));

   const nodeLayout = layoutWithDagre({
      nodes: nodes.map((n) => ({
         id: n.id,
         ...EntityTableNode.getSize(n.data),
      })),
      edges,
      graph: {
         rankdir: "LR",
         marginx: 50,
         marginy: 50,
      },
   });

   nodeLayout.nodes.forEach((node) => {
      const n = nodes.find((n) => n.id === node.id);
      if (n) {
         n.position = { x: node.x, y: node.y };
      }
   });

   return (
      <ReactFlowProvider>
         <ActualCanvas
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            minZoom={0.1}
            maxZoom={2}
            fitViewOptions={{
               minZoom: 0.1,
               maxZoom: 0.8,
            }}
         >
            <Panels zoom minimap />
         </ActualCanvas>
      </ReactFlowProvider>
   );
}

function toRecord(nodes: Node<TAppDataEntity>[]): Record<string, Node<TAppDataEntity>> {
   return Object.fromEntries(nodes.map((n) => [n.id, n]));
}

function ActualCanvas(props: CanvasProps) {
   const flow = useReactFlow();
   const { theme } = useTheme();

   const onNodesChange = useCallback((changes: any) => {
      const nodes = mergeObject<Record<string, Node<TAppDataEntity>>>(
         toRecord(flow.getNodes()),
         toRecord(changes),
      );
      const selected = Object.values(nodes).filter((n) => n.selected);
      const selected_names = selected.map((n) => n.id);
      flow.setEdges((edges) =>
         edges.map((edge) => {
            if (selected_names.includes(edge.source) || selected_names.includes(edge.target)) {
               return {
                  ...edge,
                  animated: true,
                  style: { stroke: "#6495c6" },
                  markerEnd: {
                     ...getMarkerEndStyle(theme),
                     color: "#6495c6",
                  },
               };
            }

            return {
               ...edge,
               style: getEdgeStyle(theme),
               animated: false,
               markerEnd: getMarkerEndStyle(theme),
            };
         }),
      );
   }, []);

   return <Canvas {...props} onNodesChange={onNodesChange as any} />;
}
