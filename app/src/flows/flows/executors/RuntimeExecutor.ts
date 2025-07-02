import type { Task } from "../../tasks/Task";
import { $console } from "core/utils";

export class RuntimeExecutor {
   async run(
      nextTasks: () => Task[],
      onDone?: (task: Task, result: Awaited<ReturnType<Task["run"]>>) => void,
   ) {
      const tasks = nextTasks();
      if (tasks.length === 0) {
         return;
      }

      const promises = tasks.map(async (t) => {
         const result = await t.run();
         onDone?.(t, result);
         return result;
      });

      try {
         await Promise.all(promises);
      } catch (e) {
         $console.error("RuntimeExecutor: error", e);
      }

      return this.run(nextTasks, onDone);
   }
}
