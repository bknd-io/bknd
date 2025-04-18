import { Task } from "../Task";
import * as tbbox from "@sinclair/typebox";
const { Type } = tbbox;

export class RenderTask<Output extends Record<string, any>> extends Task<
   typeof RenderTask.schema,
   Output
> {
   type = "render";

   static override schema = Type.Object({
      render: Type.String(),
   });

   async execute() {
      return this.params.render as unknown as Output;
   }
}
