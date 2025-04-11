import { Event, EventManager, type ListenerHandler } from "core/events";
import type { EmitsEvents } from "core/events";
import type { Task, TaskResult } from "../tasks/Task";
import type { Flow } from "./Flow";
import { $console } from "core";

export type TaskLog = TaskResult & {
   task: Task;
   end: Date;
};

export type InputsMap = Map<string, TaskResult>;

export class ExecutionEvent extends Event<{
   task: Task;
   result?: TaskResult;
   end?: Date;
}> {
   static override slug = "flow-execution-event";

   task() {
      return this.params.task;
   }

   getState() {
      if (this.succeeded()) return "success";
      if (this.failed()) return "failed";
      if (this.isStart()) return "running";
      return "idle";
   }

   isStart() {
      return this.params.end === undefined;
   }

   isEnd() {
      return !this.isStart();
   }

   succeeded() {
      return this.isEnd() && this.params.result?.success;
   }

   failed() {
      return this.isEnd() && !this.params.result?.success;
   }
}

export class ExecutionState extends Event<{ execution: Execution; state: "started" | "ended" }> {
   static override slug = "flow-execution-state";
}

type UnionFromRecord<T> = T[keyof T];
type ExecutionEvents = UnionFromRecord<typeof Execution.Events>;

export class Execution implements EmitsEvents {
   flow: Flow;

   started_at?: Date;
   finished_at?: Date;

   logs: TaskLog[] = [];
   inputs: InputsMap = new Map();

   // next tasks to execute
   protected queue: Task[] = [];

   emgr: EventManager;

   static Events = { ExecutionEvent, ExecutionState };

   constructor(flow: Flow) {
      this.flow = flow;
      this.logs = [];
      this.queue = [this.flow.startTask];
      this.emgr = new EventManager(Execution.Events);
   }

   subscribe(handler: ListenerHandler<ExecutionEvent | ExecutionState>) {
      this.emgr.onAny(handler as any);
   }

   async onDone(task: Task, result: TaskResult) {
      //console.log("Execution: resolved", task.name, result.success);

      const end = new Date();
      this.logs.push({ ...result, task, end });
      this.inputs.set(task.name, result);

      // if responding task completed
      if (this.flow.respondingTask === task) {
         this.queue = [];
         return;
      }

      // clear task from queue
      this.queue = this.queue.filter((t) => t !== task);

      // check outgoing tasks and add to queue if all in-tasks are finished
      /*console.log(
         "Out tasks that matches",
         this.flow
            .task(task)
            .getOutConnections(result)
            .map((c) => [c.target.name, c.max_retries])
      );*/
      const nextTasks = this.flow
         .task(task)
         .getOutConnections(result)
         .filter((c) => {
            const t = c.target;
            // @todo: potentially filter on "end" instead of "success"
            // @todo: behaves weird
            const target_runs = this.logs.filter((log) => log.task === t && log.success).length;

            // max retry is set to the IN connection
            const max_retries =
               this.flow
                  .task(t)
                  .getInConnections()
                  .find((c) => c.source === task)?.max_retries ?? 0;

            /*console.log(`tried ${task.name}->${t.name}`, {
               target_runs,
               max_retries
            });*/

            if (target_runs > max_retries) {
               //console.log("*** Task reached max retries", t.name);
               throw new Error(
                  `Task "${t.name}" reached max retries (${target_runs}/${max_retries})`,
               );
            }

            /*console.log(
               "tasks?",
               this.flow
                  .task(t)
                  .getInTasks(true)
                  .map((t) => t.name)
            );*/

            return this.flow
               .task(t)
               .getInTasks(true) // only lower
               .every((t) => this.logs.some((log) => log.task === t && log.end !== undefined));
         })
         .map((c) => c.target);

      /*console.log(
         "--- next tasks",
         nextTasks.map((t) => t.name)
      );*/

      //console.log("------");
      this.queue.push(...nextTasks);
      //await new Promise((resolve) => setTimeout(resolve, 1000));
   }

   __getLastTaskLog(task: Task) {
      for (let i = this.logs.length - 1; i >= 0; i--) {
         if (this.logs[i]?.task === task) {
            return this.logs[i];
         }
      }

      return null;
   }

   private async run() {
      const tasks = this.queue;
      if (tasks.length === 0) {
         return;
      }

      //const promises = tasks.map((t) => t.run());
      const promises = tasks.map(async (t) => {
         await this.emgr.emit(new ExecutionEvent({ task: t }));
         const result = await t.run(this.inputs);
         await this.emgr.emit(new ExecutionEvent({ task: t, result, end: new Date() }));
         await this.onDone(t, result);
         return result;
      });

      try {
         await Promise.all(promises);
         return this.run();
      } catch (e) {
         $console.error("RuntimeExecutor: error", e);

         // for now just throw
         throw e;
      }
   }

   async start(input?: any) {
      await this.emgr.emit(new ExecutionState({ execution: this, state: "started" }));

      // set initial input
      this.inputs.set("flow", {
         start: new Date(),
         output: input, // @todo: remove
         error: undefined,
         success: true,
         params: input,
      });

      //graceful && (await new Promise((resolve) => setTimeout(resolve, 100)));
      this.started_at = new Date();
      await this.run();
      this.finished_at = new Date();
      await this.emgr.emit(new ExecutionState({ execution: this, state: "ended" }));
   }

   finished(): boolean {
      return this.finished_at !== undefined;
   }

   errorCount(): number {
      return this.logs.filter((log) => !log.success).length;
   }

   hasErrors(): boolean {
      return this.errorCount() > 0;
   }

   getErrorLogs(): TaskLog[] {
      return this.logs.filter((log) => !log.success);
   }

   getErrors(): any[] {
      return this.getErrorLogs().map((log) => log.error);
   }

   getResponse() {
      let respondingTask = this.flow.respondingTask;
      if (!respondingTask) {
         respondingTask = this.flow.tasks[this.flow.tasks.length - 1];
      }

      const lastLog = this.__getLastTaskLog(respondingTask!);
      if (!lastLog) {
         return;
      }

      return lastLog.output;
   }
}
