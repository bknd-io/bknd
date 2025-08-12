import type { EventManager } from "core/events";
import type { Flow } from "../Flow";
import { Trigger } from "./Trigger";
import { $console, s } from "bknd/utils";

export class EventTrigger extends Trigger<typeof EventTrigger.schema> {
   override type = "event";

   static override schema = s.strictObject({
      event: s.string(),
      ...Trigger.schema.properties,
   });

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
