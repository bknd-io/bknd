import { MiniMap, useReactFlow, useViewport } from "@xyflow/react";
import { useState } from "react";
import { TbMaximize, TbMinus, TbPlus, TbSitemap } from "react-icons/tb";
import { Panel } from "ui/components/canvas/panels/Panel";

export type PanelsProps = {
   children?: React.ReactNode;
   coordinates?: boolean;
   minimap?: boolean;
   zoom?: boolean;
};

export function Panels({ children, ...props }: PanelsProps) {
   const [minimap, setMinimap] = useState(false);
   const reactFlow = useReactFlow();
   const { zoom, x, y } = useViewport();
   const percent = Math.round(zoom * 100);

   const handleZoomIn = async () => await reactFlow.zoomIn();
   const handleZoomReset = async () => reactFlow.zoomTo(1);
   const handleZoomOut = async () => await reactFlow.zoomOut();
   function toggleMinimap() {
      setMinimap((p) => !p);
   }

   return (
      <>
         {children}
         {props.coordinates && (
            <Panel position="bottom-center">
               <Panel.Text className="px-2" mono>
                  {x.toFixed(2)},{y.toFixed(2)}
               </Panel.Text>
            </Panel>
         )}
         <Panel unstyled position="bottom-right">
            {props.zoom && (
               <Panel.Wrapper className="px-1.5">
                  <Panel.IconButton Icon={TbPlus} round onClick={handleZoomIn} />
                  <Panel.Text className="px-2" mono onClick={handleZoomReset}>
                     {percent}%
                  </Panel.Text>
                  <Panel.IconButton Icon={TbMinus} round onClick={handleZoomOut} />
                  <Panel.IconButton Icon={TbMaximize} round onClick={handleZoomReset} />
               </Panel.Wrapper>
            )}
            {props.minimap && (
               <>
                  <Panel.Wrapper>
                     <Panel.IconButton
                        Icon={minimap ? TbSitemap : TbSitemap}
                        round
                        onClick={toggleMinimap}
                        variant={minimap ? "default" : "ghost"}
                     />
                  </Panel.Wrapper>
                  {minimap && <MiniMap style={{ bottom: 50, right: -5 }} ariaLabel={null} />}
               </>
            )}
         </Panel>
      </>
   );
}
