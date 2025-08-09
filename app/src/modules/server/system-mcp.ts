import type { App } from "App";
import { mcpSchemaSymbol, type McpSchema } from "modules/mcp";
import { getMcpServer, isObject, s, McpServer } from "bknd/utils";
import { getVersion } from "core/env";

export function getSystemMcp(app: App) {
   const middlewareServer = getMcpServer(app.server);

   const appConfig = app.modules.configs();
   const { version, ...appSchema } = app.getSchema();

   const schema = s.strictObject(appSchema);

   const nodes = [...schema.walk({ data: appConfig })].filter(
      (n) => isObject(n.schema) && mcpSchemaSymbol in n.schema,
   ) as s.Node<McpSchema>[];
   const tools = [
      // tools from hono routes
      ...middlewareServer.tools,
      // tools added from ctx
      ...app.modules.ctx().mcp.tools,
      // tools from app schema
      ...nodes.flatMap((n) => n.schema.getTools(n)),
   ];
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
