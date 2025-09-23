import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createApp } from "core/test/utils";
import { registries } from "index";
import { StorageLocalAdapter } from "adapter/node/storage/StorageLocalAdapter";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";

beforeAll(() => disableConsoleLog());
afterAll(enableConsoleLog);

describe("mcp", () => {
   it("should have tools", async () => {
      registries.media.register("local", StorageLocalAdapter);

      const app = createApp({
         config: {
            auth: {
               enabled: true,
            },
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

      // expect mcp to not be loaded yet
      expect(app.mcp).toBeNull();

      // after first request, mcp should be loaded
      await app.getMcpClient().listTools();
      expect(app.mcp?.tools.length).toBeGreaterThan(0);
   });
});
