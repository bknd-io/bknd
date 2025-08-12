import { Task } from "../Task";
import { $console, s } from "bknd/utils";

export class LogTask extends Task<typeof LogTask.schema> {
   type = "log";

   static override schema = s.strictObject({
      delay: s.number({ default: 10 }),
   });

   async execute() {
      await new Promise((resolve) => setTimeout(resolve, this.params.delay));
      $console.log(`[DONE] LogTask: ${this.name}`);
      return true;
   }
}
