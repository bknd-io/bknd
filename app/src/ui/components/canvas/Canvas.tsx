import {
   Background,
   BackgroundVariant,
   MiniMap,
   type MiniMapProps,
   ReactFlow,
   type ReactFlowProps,
   addEdge,
   useEdgesState,
   useNodesState,
   useReactFlow,
} from "@xyflow/react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useTheme } from "ui/client/use-theme";

export type CanvasProps = Omit<ReactFlowProps, "onNodesChange" | "onEdgesChange"> & {
   externalProvider?: boolean;
   backgroundStyle?: "lines" | "dots";
   minimap?: boolean | MiniMapProps;
   children?: Element | ReactNode;
   onDropNewNode?: (base: any) => any;
   onDropNewEdge?: (base: any) => any;
   onNodesChange?: (changes: any) => void;
   onEdgesChange?: (changes: any) => void;
};

export function Canvas({
   nodes: _nodes,
   edges: _edges,
   externalProvider,
   backgroundStyle = "lines",
   minimap = false,
   children,
   onDropNewNode,
   onDropNewEdge,
   ...props
}: CanvasProps) {
   const [nodes, setNodes, _onNodesChange] = useNodesState(_nodes ?? []);
   const [edges, setEdges, _onEdgesChange] = useEdgesState(_edges ?? []);
   const { screenToFlowPosition } = useReactFlow();
   const { theme } = useTheme();

   const [isCommandPressed, setIsCommandPressed] = useState(false);
   const [isSpacePressed, setIsSpacePressed] = useState(false);
   const [isPointerPressed, setIsPointerPressed] = useState(false);

   const onNodesChange = useCallback(
      (changes) => {
         _onNodesChange(changes);
         props.onNodesChange?.(changes);
      },
      [_onNodesChange, props.onNodesChange],
   );

   const onEdgesChange = useCallback(
      (changes) => {
         _onEdgesChange(changes);
         props.onEdgesChange?.(changes);
      },
      [_onEdgesChange, props.onEdgesChange],
   );

   const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey) {
         setIsCommandPressed(true);
      }
      if (event.key === " ") {
         //event.preventDefault(); // Prevent default space scrolling behavior
         setIsSpacePressed(true);
      }
   };

   const handleKeyUp = (event: KeyboardEvent) => {
      if (!event.metaKey) {
         setIsCommandPressed(false);
      }
      if (event.key === " ") {
         setIsSpacePressed(false);
      }
   };

   const handlePointerDown = () => {
      if (isSpacePressed) {
         setIsPointerPressed(false);
         return;
      }
      setIsPointerPressed(true);
   };

   const handlePointerUp = () => {
      if (isSpacePressed) {
         setIsPointerPressed(false);
         return;
      }
      setIsPointerPressed(false);
   };

   useEffect(() => {
      document.querySelector("html")?.classList.add("fixed");

      // Add global key listeners
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);

      // Add global pointer listeners
      window.addEventListener("pointerdown", handlePointerDown);
      window.addEventListener("pointerup", handlePointerUp);

      // Cleanup event listeners on component unmount
      return () => {
         window.removeEventListener("keydown", handleKeyDown);
         window.removeEventListener("keyup", handleKeyUp);
         window.removeEventListener("pointerdown", handlePointerDown);
         window.removeEventListener("pointerup", handlePointerUp);
         document.querySelector("html")?.classList.remove("fixed");
      };
   }, []);

   //console.log("mode", { cmd: isCommandPressed, space: isSpacePressed, mouse: isPointerPressed });

   useEffect(() => {
      setNodes(_nodes ?? []);
      setEdges(_edges ?? []);
   }, [_nodes, _edges]);

   const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), []);

   const onConnectEnd = useCallback(
      (event, connectionState) => {
         if (!onDropNewNode || !onDropNewEdge) return;

         const { fromNode, fromHandle, fromPosition } = connectionState;
         // when a connection is dropped on the pane it's not valid
         if (!connectionState.isValid) {
            console.log("conn", { event, connectionState });
            // we need to remove the wrapper bounds, in order to get the correct position

            const { clientX, clientY } =
               "changedTouches" in event ? event.changedTouches[0] : event;
            const newNode = onDropNewNode({
               id: "select",
               type: "default",
               data: { label: "" },
               position: screenToFlowPosition({
                  x: clientX,
                  y: clientY,
               }),
               origin: [0.0, 0.0],
            });

            setNodes((nds) => nds.concat(newNode as any));
            setEdges((eds) =>
               eds.concat(
                  onDropNewNode({
                     id: newNode.id,
                     source: connectionState.fromNode.id,
                     target: newNode.id,
                  }),
               ),
            );
         }
      },
      [screenToFlowPosition],
   );
   //console.log("edges1", edges);

   return (
      <ReactFlow
         colorMode={theme}
         onConnect={onConnect}
         onConnectEnd={onConnectEnd}
         className={
            isCommandPressed
               ? "cursor-zoom-in"
               : isSpacePressed
                 ? isPointerPressed
                    ? "cursor-grabbing"
                    : "cursor-grab"
                 : ""
         }
         proOptions={{
            hideAttribution: true,
         }}
         fitView
         fitViewOptions={{
            maxZoom: 1.5,
            ...props.fitViewOptions,
         }}
         nodeDragThreshold={25}
         panOnScrollSpeed={1}
         snapToGrid
         nodes={nodes}
         edges={edges}
         nodesConnectable={false}
         /*panOnDrag={isSpacePressed}*/
         panOnDrag={true}
         zoomOnScroll={isCommandPressed}
         panOnScroll={!isCommandPressed}
         zoomOnDoubleClick={false}
         selectionOnDrag={!isSpacePressed}
         {...props}
         onNodesChange={onNodesChange}
         onEdgesChange={onEdgesChange}
      >
         {backgroundStyle === "lines" && (
            <Background
               color={theme === "light" ? "rgba(0,0,0,.05)" : "rgba(255,255,255,.1)"}
               gap={[50, 50]}
               variant={BackgroundVariant.Lines}
            />
         )}
         {backgroundStyle === "dots" && (
            <Background color={theme === "light" ? "rgba(0,0,0,.5)" : "rgba(255,255,255,.2)"} />
         )}
         {minimap && <MiniMap {...(typeof minimap === "object" ? minimap : {})} />}
         {children}
      </ReactFlow>
   );
}
