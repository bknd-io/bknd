import Dagre from "@dagrejs/dagre";

type Position = "top" | "right" | "bottom" | "left";
type Node = {
   id: string;
   width: number;
   height: number;
   x?: number;
   y?: number;
};

type Edge = {
   id: string;
   source: string;
   target: string;
};

export type LayoutProps = {
   nodes: Node[];
   edges: Edge[];
   graph?: Dagre.GraphLabel;
};

export const layoutWithDagre = ({ nodes, edges, graph }: LayoutProps) => {
   const dagreGraph = new Dagre.graphlib.Graph();
   dagreGraph.setDefaultEdgeLabel(() => ({}));
   dagreGraph.setGraph(graph || {});

   nodes.forEach((node) => {
      dagreGraph.setNode(node.id, {
         width: node.width,
         height: node.height,
      });
   });

   edges.forEach((edge) => {
      dagreGraph.setEdge(edge.target, edge.source);
   });

   Dagre.layout(dagreGraph);

   return {
      nodes: nodes.map((node) => {
         const position = dagreGraph.node(node.id);
         return {
            ...node,
            position: {
               x: position.x - (node.width ?? 0) / 2,
               y: position.y - (node.height ?? 0) / 2,
            },
         };
      }),
      edges,
   };
};
