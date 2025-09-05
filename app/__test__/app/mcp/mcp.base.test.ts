import { describe, it, expect } from "bun:test";
import { createApp } from "core/test/utils";
import { registries } from "index";
import { StorageLocalAdapter } from "adapter/node/storage/StorageLocalAdapter";

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

      expect(app.mcp?.tools.length).toBeGreaterThan(0);
   });
});
