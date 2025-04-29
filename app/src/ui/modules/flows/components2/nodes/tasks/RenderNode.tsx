import { IconWorld } from "@tabler/icons-react";
import { BaseNode } from "../BaseNode";
import { HtmlEditor } from "ui/components/code/HtmlEditor";

export function RenderNode(props) {
   return (
      <BaseNode {...props} onChangeName={console.log} Icon={IconWorld} className="w-[400px]">
         <form className="flex flex-col gap-3">
            <HtmlEditor value={props.params.render} onChange={console.log} />
         </form>
      </BaseNode>
   );
}
