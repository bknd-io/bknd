import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { createApp } from "core/test/utils";
import { em, entity, text } from "data/prototype";
import { registries } from "modules/registries";
import { StorageLocalAdapter } from "adapter/node/storage/StorageLocalAdapter";
import { AppMedia } from "../../src/media/AppMedia";
import { moduleTestSuite } from "./module-test-suite";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

describe("AppMedia", () => {
   // Debug helper: logs the default media module config (skipped in normal test runs)
   test.skip("logs media config", () => {
      const media = new AppMedia();
      console.log(media.toJSON());
   });

   moduleTestSuite(AppMedia);

   test("should allow additional fields", async () => {
      registries.media.register("local", StorageLocalAdapter);

      const app = createApp({
         config: {
            media: {
               entity_name: "media",
               enabled: true,
               adapter: {
                  type: "local",
                  config: {
                     path: "./",
                  },
               },
            },
            data: em({
               media: entity("media", {
                  additional: text(),
               }),
            }).toJSON(),
         },
      });

      await app.build();

      const e = app.modules.em.entity("media");
      const fields = e.fields.map((f) => f.name);
      expect(e.type).toBe("system");
      expect(fields).toContain("additional");
      expect(fields).toEqual([
         "id",
         "additional",
         "path",
         "folder",
         "mime_type",
         "size",
         "scope",
         "etag",
         "modified_at",
         "reference",
         "entity_id",
         "metadata",
      ]);
   });
});
