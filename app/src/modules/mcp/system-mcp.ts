import type { App } from "App";
import { mcpSchemaSymbol, type McpSchema } from "modules/mcp";
import { getMcpServer, isObject, s, McpServer } from "bknd/utils";
import { getVersion } from "core/env";

export function getSystemMcp(app: App) {
   const middlewareServer = getMcpServer(app.server);

   //const appConfig = app.modules.configs();
   const { version, ...appSchema } = app.getSchema();
   const schema = s.strictObject(appSchema);
   const result = [...schema.walk({ maxDepth: 3 })];
   const nodes = result.filter((n) => mcpSchemaSymbol in n.schema) as s.Node<McpSchema>[];
   const tools = [
      // tools from hono routes
      ...middlewareServer.tools,
      // tools added from ctx
      ...app.modules.ctx().mcp.tools,
   ].sort((a, b) => a.name.localeCompare(b.name));

   // tools from app schema
   if (!app.isReadOnly()) {
      tools.push(
         ...nodes.flatMap((n) => n.schema.getTools(n)).sort((a, b) => a.name.localeCompare(b.name)),
      );
   }

   const resources = [...middlewareServer.resources, ...app.modules.ctx().mcp.resources];

   return new McpServer(
      {
         name: "bknd",
         version: getVersion(),
      },
      { app, ctx: () => app.modules.ctx() },
      tools,
      resources,
   );
}
