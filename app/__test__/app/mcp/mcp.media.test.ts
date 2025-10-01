import { describe, test, expect, beforeAll, beforeEach, afterAll } from "bun:test";
import { type App, createApp, createMcpToolCaller } from "core/test/utils";
import { getSystemMcp } from "modules/mcp/system-mcp";
import { registries } from "index";
import { StorageLocalAdapter } from "adapter/node/storage/StorageLocalAdapter";
import { disableConsoleLog, enableConsoleLog } from "core/utils";
import type { McpServer } from "bknd/utils";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

/**
 * - [x] config_media_get
 * - [x] config_media_update
 * - [x] config_media_adapter_get
 * - [x] config_media_adapter_update
 */
describe("mcp media", async () => {
   let app: App;
   let server: McpServer;
   beforeEach(async () => {
      registries.media.register("local", StorageLocalAdapter);
      app = createApp({
         config: {
            media: {
               enabled: true,
               adapter: {
                  type: "local",
                  config: {
                     path: "./",
                  },
               },
            },
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
      server.setLogLevel("error");
      server.onNotification((message) => {
         console.dir(message, { depth: null });
      });
   });

   const tool = createMcpToolCaller();

   test("config_media_{get,update}", async () => {
      const result = await tool(server, "config_media_get", {});
      expect(result).toEqual({
         path: "",
         secrets: false,
         partial: false,
         value: app.toJSON().media,
      });

      // partial
      expect((await tool(server, "config_media_get", { path: "adapter" })).value).toEqual({
         type: "local",
         config: {
            path: "./",
         },
      });

      // update
      await tool(server, "config_media_update", {
         value: {
            storage: {
               body_max_size: 1024 * 1024 * 10,
            },
         },
         return_config: true,
      });
      expect(app.toJSON().media.storage.body_max_size).toBe(1024 * 1024 * 10);
   });

   test("config_media_adapter_{get,update}", async () => {
      const result = await tool(server, "config_media_adapter_get", {});
      expect(result).toEqual({
         secrets: false,
         value: app.toJSON().media.adapter,
      });

      // update
      await tool(server, "config_media_adapter_update", {
         value: {
            type: "local",
            config: {
               path: "./subdir",
            },
         },
      });
      const adapter = app.toJSON().media.adapter as any;
      expect(adapter.config.path).toBe("./subdir");
      expect(adapter.type).toBe("local");

      // set to s3
      {
         await tool(server, "config_media_adapter_update", {
            value: {
               type: "s3",
               config: {
                  access_key: "123",
                  secret_access_key: "456",
                  url: "https://example.com/what",
               },
            },
         });

         const adapter = app.toJSON(true).media.adapter as any;
         expect(adapter.type).toBe("s3");
         expect(adapter.config.url).toBe("https://example.com/what");
      }
   });
});
