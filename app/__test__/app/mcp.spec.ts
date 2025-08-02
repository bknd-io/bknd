import { describe, it, expect } from "bun:test";
import { makeAppFromEnv } from "cli/commands/run";
import { createApp } from "core/test/utils";
import { ObjectToolSchema } from "modules/mcp";
import { s } from "bknd/utils";

describe("mcp", () => {
   it("...", async () => {
      const app = createApp({
         initialConfig: {
            auth: {
               enabled: true,
            },
         },
      });
      await app.build();

      const appConfig = app.modules.configs();
      const { version, ...appSchema } = app.getSchema();

      const schema = s.strictObject(appSchema);

      const nodes = [...schema.walk({ data: appConfig })]
         .map((n) => {
            const path = n.instancePath.join(".");
            if (path.startsWith("auth")) {
               console.log("schema", n.instancePath, n.schema.constructor.name);
               if (path === "auth.jwt") {
                  //console.log("jwt", n.schema.IS_MCP);
               }
            }
            return n;
         })
         .filter((n) => n.schema instanceof ObjectToolSchema) as s.Node<ObjectToolSchema>[];
      const tools = nodes.flatMap((n) => n.schema.getTools(n));

      console.log(
         "tools",
         tools.map((t) => t.name),
      );
   });
});
