import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { type App, createApp, createMcpToolCaller } from "core/test/utils";
import type { McpServer } from "bknd/utils";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";

beforeAll(() => disableConsoleLog());
afterAll(enableConsoleLog);

/**
 * - [x] config_server_get
 * - [x] config_server_update
 */
describe("mcp system", async () => {
   let app: App;
   let server: McpServer;
   beforeAll(async () => {
      app = createApp({
         config: {
            server: {
               mcp: {
                  enabled: true,
               },
            },
         },
      });
      await app.build();
      await app.getMcpClient().ping();
      server = app.mcp!;
   });

   const tool = createMcpToolCaller();

   test("config_server_get", async () => {
      const result = await tool(server, "config_server_get", {});
      expect(JSON.parse(JSON.stringify(result))).toEqual({
         path: "",
         secrets: false,
         partial: false,
         value: JSON.parse(JSON.stringify(app.toJSON().server)),
      });
   });

   test("config_server_get2", async () => {
      const result = await tool(server, "config_server_get", {});
      expect(JSON.parse(JSON.stringify(result))).toEqual({
         path: "",
         secrets: false,
         partial: false,
         value: JSON.parse(JSON.stringify(app.toJSON().server)),
      });
   });

   test("config_server_update", async () => {
      const original = JSON.parse(JSON.stringify(app.toJSON().server));
      const result = await tool(server, "config_server_update", {
         value: {
            cors: {
               origin: "http://localhost",
            },
         },
         return_config: true,
      });

      expect(JSON.parse(JSON.stringify(result))).toEqual({
         success: true,
         module: "server",
         config: {
            ...original,
            cors: {
               ...original.cors,
               origin: "http://localhost",
            },
         },
      });
      expect(app.toJSON().server.cors.origin).toBe("http://localhost");
   });
});
