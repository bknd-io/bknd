import { describe, expect, test } from "bun:test";
import { createApp, registries } from "../../src";
import { em, entity, text } from "../../src/data";
import { StorageLocalAdapter } from "adapter/node/storage/StorageLocalAdapter";
import { AppMedia } from "../../src/modules";
import { moduleTestSuite } from "./module-test-suite";

describe("AppMedia", () => {
   moduleTestSuite(AppMedia);

   test("should allow additional fields", async () => {
      registries.media.register("local", StorageLocalAdapter);

      const app = createApp({
         initialConfig: {
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
