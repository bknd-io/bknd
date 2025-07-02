import { $console, transformObject } from "core/utils";
import { type TaskMapType, TriggerMap } from "../index";
import type { Task } from "../tasks/Task";
import { Condition, TaskConnection } from "../tasks/TaskConnection";
import { Execution } from "./Execution";
import { FlowTaskConnector } from "./FlowTaskConnector";
import { Trigger } from "./triggers/Trigger";

type Jsoned<T extends { toJSON: () => object }> = ReturnType<T["toJSON"]>;

export class Flow {
   name: string;

   trigger: Trigger;

   /**
    * The tasks that are part of the flow
    */
   tasks: Task[] = [];

   /**
    * The connections between tasks
    */
   connections: TaskConnection[] = [];

   /**
    * The task that should mark the flow response.
    * If none given, then the flow has no response.
    */
   respondingTask?: Task;

   startTask: Task;

   // sequence of tasks
   sequence: Task[][];

   constructor(name: string, tasks: Task[], connections?: TaskConnection[], trigger?: Trigger) {
      this.name = name;
      this.trigger = trigger ?? new Trigger();

      tasks.map((t) => this.addTask(t));
      this.connections = connections || [];

      // defaulting to the first given
      this.startTask = tasks[0]!;
      this.sequence = this.getSequence();
   }

   setStartTask(task: Task) {
      this.startTask = task;
      this.sequence = this.getSequence();
      return this;
   }

   getSequence(sequence: Task[][] = []): Task[][] {
      // start task
      if (sequence.length === 0) {
         sequence.push([this.startTask]);
         return this.getSequence(sequence);
      }

      const tasks = sequence[sequence.length - 1];
      const nextStep: Task[] = [];
      tasks?.forEach((task) => {
         const outTasks = this.task(task).getOutTasks();
         outTasks.forEach((outTask) => {
            // check if task already in one of queue steps
            // this is when we have a circle back
            if (sequence.some((step) => step.includes(outTask))) {
               return;
            }
            nextStep.push(outTask);
         });
      });

      // if no next steps, break out
      if (nextStep.length === 0) {
         return sequence;
      }

      sequence.push(nextStep);

      return this.getSequence(sequence);
   }

   addTask(task: Task) {
      // check if task exists
      if (this.tasks.includes(task)) {
         throw new Error("Task already defined");
      }
      if (this.tasks.some((t) => t.name === task.name)) {
         throw new Error(`Task with name "${task.name}" already defined. Use a unique name.`);
      }

      this.tasks.push(task);

      return this;
   }

   setRespondingTask(task: Task) {
      // check if task exists
      if (!this.tasks.includes(task)) {
         throw new Error(`Cannot set task "${task.name}" as responding, not registered.`);
      }

      this.respondingTask = task;
      return this;
   }

   // @todo: check for existence
   addConnection(connection: TaskConnection) {
      // check if connection already exists
      const exists = this.connections.some((c) => {
         return (
            c.source === connection.source &&
            c.target === connection.target &&
            // @todo: should it check for condition at all?
            c.condition[0] === connection.condition[0] &&
            c.condition[1] === connection.condition[1]
         );
      });
      if (exists) {
         throw new Error("Connection already defined");
      }

      this.connections.push(connection);

      return this;
   }

   task(source: Task) {
      return new FlowTaskConnector(this, source);
   }

   createExecution() {
      this.sequence = this.getSequence();
      return new Execution(this);
   }

   /**
    * Shorthand for creating and starting an execution
    */
   async start(input: any = undefined) {
      const execution = this.createExecution();
      await execution.start(input);
      return execution;
   }

   toJSON() {
      return {
         trigger: this.trigger.toJSON(),
         tasks: Object.fromEntries(this.tasks.map((t) => [t.name, t.toJSON()])),
         connections: Object.fromEntries(this.connections.map((c) => [c.id, c.toJSON()])),
         start_task: this.startTask?.name,
         responding_task: this.respondingTask?.name,
      };
   }

   static fromObject(name: string, obj: Jsoned<Flow>, taskMap: TaskMapType) {
      const tasks = transformObject(obj.tasks ?? {}, (obj, name) => {
         const taskClass = taskMap[obj.type];
         if (!taskClass) {
            throw new Error(`Task ${name} not found in taskMap`);
         }

         try {
            const cls = taskClass.cls;
            // @ts-ignore
            return new cls(name, obj.params);
         } catch (e: any) {
            $console.error("Error creating task", name, obj.type, obj, taskClass);
            throw new Error(`Error creating task ${obj.type}: ${e.message}`);
         }
      });

      const connections = transformObject(obj.connections ?? {}, (obj, id) => {
         const condition = obj.config.condition
            ? Condition.fromObject(obj.config.condition)
            : undefined;
         return new TaskConnection(
            tasks[obj.source],
            tasks[obj.target],
            { ...obj.config, condition },
            id as string,
         );
      });

      let trigger: Trigger | undefined;
      if (obj.trigger) {
         const cls = TriggerMap[obj.trigger.type as any]?.cls;
         if (cls) {
            trigger = new cls(obj.trigger.config);
         }
      }

      const flow = new Flow(name, Object.values(tasks), Object.values(connections), trigger);
      flow.startTask = obj.start_task ? tasks[obj.start_task] : null;
      if (obj.responding_task) {
         flow.respondingTask = tasks[obj.responding_task];
      }
      return flow;
   }
}
