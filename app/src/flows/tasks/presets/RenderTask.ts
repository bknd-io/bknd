import { Task } from "../Task";
import { s } from "bknd/utils";

export class RenderTask<Output extends Record<string, any>> extends Task<
   typeof RenderTask.schema,
   Output
> {
   type = "render";

   static override schema = s.strictObject({
      render: s.string(),
   });

   async execute() {
      return this.params.render as unknown as Output;
   }
}
