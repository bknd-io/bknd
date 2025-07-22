import { Flow } from "../../flows/Flow";
import { Task, dynamic } from "../Task";
import { s } from "bknd/utils";

export class SubFlowTask<Output extends Record<string, any>> extends Task<
   typeof SubFlowTask.schema,
   Output
> {
   type = "subflow";

   static override schema = s.strictObject({
      flow: s.any(),
      input: dynamic(s.any(), JSON.parse).optional(),
      loop: s.boolean().optional(),
   });

   async execute() {
      const flow = this.params.flow;
      if (!(flow instanceof Flow)) {
         throw new Error("Invalid flow provided");
      }

      if (this.params.loop) {
         const _input = Array.isArray(this.params.input) ? this.params.input : [this.params.input];

         const results: any[] = [];
         for (const input of _input) {
            const execution = flow.createExecution();
            await execution.start(input);
            results.push(await execution.getResponse());
         }

         return results;
      }

      const execution = flow.createExecution();
      await execution.start(this.params.input);
      return execution.getResponse();
   }
}
