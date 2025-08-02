import type { CliCommand } from "cli/types";
import { makeAppFromEnv } from "../run";
import { s, mcp as mcpMiddleware, McpServer } from "bknd/utils";
import { ObjectToolSchema } from "modules/mcp";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { Module } from "modules/Module";

export const mcp: CliCommand = (program) =>
   program
      .command("mcp")
      .description("mcp server")
      .option("--port <port>", "port to listen on", "3000")
      .option("--path <path>", "path to listen on", "/mcp")
      .action(action);

async function action(options: { port: string; path: string }) {
   const app = await makeAppFromEnv({
      server: "node",
   });

   const appConfig = app.modules.configs();
   const { version, ...appSchema } = app.getSchema();

   const schema = s.strictObject(appSchema);

   const nodes = [...schema.walk({ data: appConfig })].filter(
      (n) => n.schema instanceof ObjectToolSchema,
   ) as s.Node<ObjectToolSchema>[];
   const tools = [...nodes.flatMap((n) => n.schema.getTools(n)), ...app.modules.ctx().mcp.tools];
   const resources = [...app.modules.ctx().mcp.resources];

   const server = new McpServer(
      {
         name: "bknd",
         version: "0.0.1",
      },
      { app, ctx: () => app.modules.ctx() },
      tools,
      resources,
   );
   server
      .resource("system_config", "bknd://system/config", (c) =>
         c.json(c.context.app.toJSON(), {
            title: "System Config",
         }),
      )
      .resource(
         "system_config_module",
         "bknd://system/config/{module}",
         (c, { module }) => {
            const m = c.context.app.modules.get(module as any) as Module;
            return c.json(m.toJSON(), {
               title: `Config for ${module}`,
            });
         },
         {
            list: Object.keys(appConfig),
         },
      )
      .resource("system_schema", "bknd://system/schema", (c) =>
         c.json(c.context.app.getSchema(), {
            title: "System Schema",
         }),
      )
      .resource(
         "system_schema_module",
         "bknd://system/schema/{module}",
         (c, { module }) => {
            const m = c.context.app.modules.get(module as any);
            return c.json(m.getSchema().toJSON(), {
               title: `Schema for ${module}`,
            });
         },
         {
            list: Object.keys(appSchema),
         },
      );

   const hono = new Hono().use(
      mcpMiddleware({
         server,
         endpoint: {
            path: String(options.path) as any,
         },
      }),
   );

   serve({
      fetch: hono.fetch,
      port: Number(options.port) || 3000,
   });
   console.info(`Server is running on http://localhost:${options.port}${options.path}`);
   console.info(`⚙️  Tools:\n${server.tools.map((t) => `- ${t.name}`).join("\n")}\n`);
   console.info(`📚 Resources:\n${server.resources.map((r) => `- ${r.name}`).join("\n")}`);
}
