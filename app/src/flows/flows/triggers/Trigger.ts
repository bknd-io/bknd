import { type Static, StringEnum, parse } from "core/utils";
import type { Execution } from "../Execution";
import type { Flow } from "../Flow";
import * as tbbox from "@sinclair/typebox";
const { Type } = tbbox;

export class Trigger<Schema extends typeof Trigger.schema = typeof Trigger.schema> {
   // @todo: remove this
   executions: Execution[] = [];
   type = "manual";
   config: Static<Schema>;

   static schema = Type.Object({
      mode: StringEnum(["sync", "async"], { default: "async" }),
   });

   constructor(config?: Partial<Static<Schema>>) {
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
