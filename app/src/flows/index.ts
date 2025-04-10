import { FetchTask } from "./tasks/presets/FetchTask";
import { LogTask } from "./tasks/presets/LogTask";
import { RenderTask } from "./tasks/presets/RenderTask";
import { SubFlowTask } from "./tasks/presets/SubFlowTask";

export { Flow } from "./flows/Flow";
export {
   Execution,
   type TaskLog,
   type InputsMap,
   ExecutionState,
   ExecutionEvent,
} from "./flows/Execution";
export { RuntimeExecutor } from "./flows/executors/RuntimeExecutor";
export { FlowTaskConnector } from "./flows/FlowTaskConnector";

export {
   Trigger,
   EventTrigger,
   HttpTrigger,
   TriggerMap,
   type TriggerMapType,
} from "./flows/triggers";

import { Task } from "./tasks/Task";
export type { TaskResult, TaskRenderProps } from "./tasks/Task";
export { TaskConnection, Condition } from "./tasks/TaskConnection";

export const TaskMap = {
   fetch: { cls: FetchTask },
   log: { cls: LogTask },
   render: { cls: RenderTask },
   subflow: { cls: SubFlowTask },
} as const;
export type TaskMapType = typeof TaskMap;

export { Task, FetchTask, LogTask, RenderTask, SubFlowTask };
