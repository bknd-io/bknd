import type { Context, Hono } from "hono";
import type { Flow } from "../Flow";
import { Trigger } from "./Trigger";
import { s } from "bknd/utils";

const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export class HttpTrigger extends Trigger<typeof HttpTrigger.schema> {
   override type = "http";

   static override schema = s.strictObject({
      path: s.string({ pattern: "^/.*$" }),
      method: s.string({ enum: httpMethods, default: "GET" }),
      response_type: s.string({ enum: ["json", "text", "html"], default: "json" }),
      ...Trigger.schema.properties,
   });

   override async register(flow: Flow, hono: Hono<any>) {
      const method = this.config.method.toLowerCase() as any;

      hono[method](this.config.path, async (c: Context) => {
         const params = c.req.raw;
         const respond = c[this.config.response_type] as any;
         const execution = flow.createExecution();
         this.executions.push(execution);

         if (this.config.mode === "sync") {
            await execution.start(params);
            const response = execution.getResponse();
            const errors = execution.getErrors();
            if (errors.length > 0) {
               return c.json({ success: false, errors });
            }

            return respond(response);
         }

         execution.start(params);
         return c.json({ success: true });
      });
   }
}
