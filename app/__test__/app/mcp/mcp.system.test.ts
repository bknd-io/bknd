import { AppEvents } from "App";
import { describe, test, expect, beforeAll, mock } from "bun:test";
import { type App, createApp, createMcpToolCaller } from "core/test/utils";
import type { McpServer } from "bknd/utils";

/**
 * - [x] system_config
 * - [x] system_build
 * - [x] system_ping
 * - [x] system_info
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
      server = app.mcp!;
   });

   const tool = createMcpToolCaller();

   test("system_ping", async () => {
      const result = await tool(server, "system_ping", {});
      expect(result).toEqual({ pong: true });
   });

   test("system_info", async () => {
      const result = await tool(server, "system_info", {});
      expect(Object.keys(result).length).toBeGreaterThan(0);
      expect(Object.keys(result)).toContainValues(["version", "runtime", "connection"]);
   });

   test("system_build", async () => {
      const called = mock(() => null);

      app.emgr.onEvent(AppEvents.AppBuiltEvent, () => void called(), { once: true });

      const result = await tool(server, "system_build", {});
      expect(called).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
   });

   test("system_config", async () => {
      const result = await tool(server, "system_config", {});
      expect(result).toEqual(app.toJSON());
   });
});
