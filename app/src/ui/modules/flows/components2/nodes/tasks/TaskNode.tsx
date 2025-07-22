import { type Node, type NodeProps, Position } from "@xyflow/react";
import type { TAppFlowTaskSchema } from "flows/AppFlows";
import { useFlowCanvas, useFlowSelector } from "../../../hooks/use-flow";
import { Handle } from "../Handle";
import { FetchTaskForm } from "./FetchTaskNode";
import { RenderNode } from "./RenderNode";

const TaskComponents = {
   fetch: FetchTaskForm,
   render: RenderNode,
};

export const TaskNode = (
   props: NodeProps<
      Node<
         TAppFlowTaskSchema & {
            label: string;
            last?: boolean;
            start?: boolean;
            responding?: boolean;
         }
      >
   >,
) => {
   const {
      data: { label, start, last, responding },
   } = props;
   const task = useFlowSelector((s) => s.flow!.tasks![label])!;
   const { actions } = useFlowCanvas();

   const Component =
      task.type in TaskComponents ? TaskComponents[task.type] : () => <div>unsupported</div>;

   function handleChange(params: any) {
      //console.log("TaskNode:update", task.type, label, params);
      actions.task.update(label, params);
   }

   return (
      <>
         <Component {...props} params={task.params as any} onChange={handleChange} />

         <Handle type="target" id={`${label}-in`} />
         <Handle type="source" id={`${label}-out`} />
      </>
   );
};
