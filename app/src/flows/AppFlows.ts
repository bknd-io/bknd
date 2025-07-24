import { Flow, HttpTrigger } from "flows";
import { Hono } from "hono";
import { Module } from "modules/Module";
import { TASKS, flowsConfigSchema } from "./flows-schema";
import { type s, transformObject } from "bknd/utils";

export type AppFlowsSchema = s.Static<typeof flowsConfigSchema>;
export type TAppFlowSchema = AppFlowsSchema["flows"][number];
export type TAppFlowTriggerSchema = TAppFlowSchema["trigger"];
export type { TAppFlowTaskSchema } from "./flows-schema";

export class AppFlows extends Module<AppFlowsSchema> {
   private flows: Record<string, Flow> = {};

   getSchema() {
      return flowsConfigSchema;
   }

   private getFlowInfo(flow: Flow) {
      return {
         ...flow.toJSON(),
         tasks: flow.tasks.length,
         connections: flow.connections,
      };
   }

   override async build() {
      const flows = transformObject(this.config.flows, (flowConfig, name) => {
         return Flow.fromObject(name, flowConfig as any, TASKS);
      });

      this.flows = flows;

      const hono = new Hono();

      hono.get("/", async (c) => {
         const flowsInfo = transformObject(this.flows, (flow) => this.getFlowInfo(flow));
         return c.json(flowsInfo);
      });

      hono.get("/flow/:name", async (c) => {
         const name = c.req.param("name");
         return c.json(this.flows[name]?.toJSON());
      });

      hono.get("/flow/:name/run", async (c) => {
         const name = c.req.param("name");
         const flow = this.flows[name]!;
         const execution = flow.createExecution();

         const start = performance.now();
         await execution.start();
         const time = performance.now() - start;
         const errors = execution.getErrors();
         return c.json({
            success: errors.length === 0,
            time,
            errors,
            response: execution.getResponse(),
            flow: this.getFlowInfo(flow),
            logs: execution.logs,
         });
      });

      hono.all("*", (c) => c.notFound());

      this.ctx.server.route(this.config.basepath, hono);

      // register flows
      for (const [name, flow] of Object.entries(this.flows)) {
         const trigger = flow.trigger;

         switch (true) {
            case trigger instanceof HttpTrigger:
               await trigger.register(flow, this.ctx.server);
               break;
         }
      }

      this.setBuilt();
   }

   // @todo: fix this
   // @ts-expect-error
   override toJSON() {
      return {
         ...this.config,
         flows: transformObject(this.flows, (flow) => flow.toJSON()),
      };
   }
}
