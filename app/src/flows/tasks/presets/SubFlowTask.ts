import { Flow } from "../../flows/Flow";
import { Task, dynamic } from "../Task";
import * as tbbox from "@sinclair/typebox";
const { Type } = tbbox;

export class SubFlowTask<Output extends Record<string, any>> extends Task<
   typeof SubFlowTask.schema,
   Output
> {
   type = "subflow";

   static override schema = Type.Object({
      flow: Type.Any(),
      input: Type.Optional(dynamic(Type.Any(), JSON.parse)),
      loop: Type.Optional(Type.Boolean()),
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
