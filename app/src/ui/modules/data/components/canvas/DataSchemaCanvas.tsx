import { MarkerType, type Node, Position, ReactFlowProvider } from "@xyflow/react";
import type { AppDataConfig, TAppDataEntity } from "data/data-schema";
import { useBknd } from "ui/client/BkndProvider";
import { Canvas } from "ui/components/canvas/Canvas";
import { layoutWithDagre } from "ui/components/canvas/layouts";
import { Panels } from "ui/components/canvas/panels";
import { EntityTableNode } from "./EntityTableNode";
import { useTheme } from "ui/client/use-theme";
import { Panel } from "ui/components/canvas/panels/Panel";
import { TbLayout } from "react-icons/tb";
import { useState } from "react";
import { type CanvasPosition, dataCanvasStore } from "ui/store";

function entitiesToNodes(entities: AppDataConfig["entities"]): Node<TAppDataEntity>[] {
   return Object.entries(entities ?? {}).map(([name, entity]) => {
      return {
         id: name,
         data: { label: name, ...entity },
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

function getNodeAutoLayout(nodes: Node<TAppDataEntity>[], edges: any[]): CanvasPosition[] {
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

   return nodeLayout.nodes.map((n) => ({
      id: n.id,
      ...n.position,
   }));
}

function setNodesLayout(nodes: Node<TAppDataEntity>[], layout: CanvasPosition[]) {
   return nodes.map((node) => {
      const pos = layout.find((l) => l.id === node.id);
      if (pos) {
         return {
            ...node,
            position: { x: pos.x, y: pos.y },
         };
      }
      return node;
   });
}

export function DataSchemaCanvas() {
   const {
      config: { data },
   } = useBknd();
   const { theme } = useTheme();

   const edges = relationsToEdges(data.relations).map((e) => ({
      ...e,
      style: {
         stroke: theme === "light" ? "#ccc" : "#666",
      },
      type: "smoothstep",
      markerEnd: {
         type: MarkerType.Arrow,
         width: 20,
         height: 20,
         color: theme === "light" ? "#aaa" : "#777",
      },
   }));

   const entityNodes = entitiesToNodes(data.entities);
   const positions = dataCanvasStore((state) => state.positions);
   const setPositions = dataCanvasStore((state) => state.setPositions);
   const resetPositions = dataCanvasStore((state) => state.reset);

   const layout = positions ? positions : getNodeAutoLayout(entityNodes, edges);
   const [nodes, setNodes] = useState<Node<TAppDataEntity>[]>(setNodesLayout(entityNodes, layout));

   function setLayout(positions: CanvasPosition[] = getNodeAutoLayout(entityNodes, edges)) {
      setNodes(setNodesLayout(entityNodes, positions));
   }

   function resetLayout() {
      resetPositions();
      setLayout();
   }

   return (
      <ReactFlowProvider>
         <Canvas
            nodes={nodes}
            edges={edges}
            onNodeDragStop={(e, node) => {
               const positions = nodes
                  .map((n) => (n.id === node.id ? node : n))
                  .map((n) => ({ id: n.id, ...n.position }));
               setPositions(positions);
               setLayout(positions);
            }}
            nodeTypes={nodeTypes}
            minZoom={0.1}
            maxZoom={2}
            fitViewOptions={{
               minZoom: 0.1,
               maxZoom: 0.8,
            }}
         >
            <Panels zoom minimap>
               <Panel position="bottom-left">
                  <Panel.IconButton round Icon={TbLayout} onClick={resetLayout} />
               </Panel>
            </Panels>
         </Canvas>
      </ReactFlowProvider>
   );
}
