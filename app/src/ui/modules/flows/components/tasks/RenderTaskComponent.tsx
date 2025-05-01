import { TaskForm } from "../form/TaskForm";
import { TaskComponent, type TaskComponentProps } from "./TaskComponent";

export function RenderTaskComponent(props: TaskComponentProps) {
   const { task } = props.data;
   return (
      <TaskComponent {...props}>
         <TaskForm
            task={task}
            onChange={console.log}
            uiSchema={{
               render: {
                  "ui:field": "HtmlField",
               },
            }}
         />
      </TaskComponent>
   );
}
