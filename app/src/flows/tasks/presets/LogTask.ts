import { Task } from "../Task";
import { $console } from "core";
import * as tbbox from "@sinclair/typebox";
const { Type } = tbbox;

export class LogTask extends Task<typeof LogTask.schema> {
   type = "log";

   static override schema = Type.Object({
      delay: Type.Number({ default: 10 }),
   });

   async execute() {
      await new Promise((resolve) => setTimeout(resolve, this.params.delay));
      $console.log(`[DONE] LogTask: ${this.name}`);
      return true;
   }
}
