import type { Execution } from "../Execution";
import type { Flow } from "../Flow";
import { s, parse } from "bknd/utils";

export class Trigger<Schema extends typeof Trigger.schema = typeof Trigger.schema> {
   // @todo: remove this
   executions: Execution[] = [];
   type = "manual";
   config: s.Static<Schema>;

   static schema = s.strictObject({
      mode: s.string({ enum: ["sync", "async"], default: "async" }),
   });

   constructor(config?: Partial<s.Static<Schema>>) {
      const schema = (this.constructor as typeof Trigger).schema;
      // @ts-ignore for now
      this.config = parse(schema, config ?? {});
   }

   async register(flow: Flow, ...args: any[]): Promise<void> {
      // @todo: remove this
      this.executions.push(await flow.start());
   }

   toJSON() {
      return {
         type: this.type,
         config: this.config,
      };
   }
}
