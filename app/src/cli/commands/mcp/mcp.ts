import type { CliCommand } from "cli/types";
import { makeAppFromEnv } from "../run";
import { s, mcp as mcpMiddleware, McpServer, isObject } from "bknd/utils";
import type { McpSchema } from "modules/mcp";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { mcpSchemaSymbol } from "modules/mcp/McpSchemaHelper";

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
      (n) => isObject(n.schema) && mcpSchemaSymbol in n.schema,
   ) as s.Node<McpSchema>[];
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
   console.info(
      `⚙️  Tools (${server.tools.length}):\n${server.tools.map((t) => `- ${t.name}`).join("\n")}\n`,
   );
   console.info(
      `📚 Resources (${server.resources.length}):\n${server.resources.map((r) => `- ${r.name}`).join("\n")}`,
   );
}
