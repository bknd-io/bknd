import { StringEnum } from "core/utils";
import type { Context, Hono } from "hono";
import type { Flow } from "../Flow";
import { Trigger } from "./Trigger";
import * as tbbox from "@sinclair/typebox";
const { Type } = tbbox;

const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export class HttpTrigger extends Trigger<typeof HttpTrigger.schema> {
   override type = "http";

   static override schema = Type.Composite([
      Trigger.schema,
      Type.Object({
         path: Type.String({ pattern: "^/.*$" }),
         method: StringEnum(httpMethods, { default: "GET" }),
         response_type: StringEnum(["json", "text", "html"], { default: "json" }),
      }),
   ]);

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
