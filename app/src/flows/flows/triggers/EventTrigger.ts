import type { EventManager } from "core/events";
import type { Flow } from "../Flow";
import { Trigger } from "./Trigger";
import { $console } from "core";
import * as tbbox from "@sinclair/typebox";
const { Type } = tbbox;

export class EventTrigger extends Trigger<typeof EventTrigger.schema> {
   override type = "event";

   static override schema = Type.Composite([
      Trigger.schema,
      Type.Object({
         event: Type.String(),
         // add match
      }),
   ]);

   override async register(flow: Flow, emgr: EventManager<any>) {
      if (!emgr.eventExists(this.config.event)) {
         throw new Error(`Event ${this.config.event} is not registered.`);
      }

      emgr.on(
         this.config.event,
         async (event) => {
            const execution = flow.createExecution();
            this.executions.push(execution);

            try {
               await execution.start(event.params);
            } catch (e) {
               $console.error(e);
            }
         },
         this.config.mode,
      );
   }
}
