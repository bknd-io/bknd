import { describe, expect, test } from "bun:test";
import { createApp, registries } from "../../src";
import * as proto from "../../src/data/prototype";
import { StorageLocalAdapter } from "adapter/node/storage/StorageLocalAdapter";

describe("repros", async () => {
   /**
    * steps:
    * 1. enable media
    * 2. create 'test' entity
    * 3. add media to 'test'
    *
    * There was an issue that AppData had old configs because of system entity "media"
    */
   test("registers media entity correctly to relate to it", async () => {
      registries.media.register("local", StorageLocalAdapter);
      const app = createApp();
      await app.build();

      {
         // 1. enable media
         const [, config] = await app.module.media.schema().patch("", {
            enabled: true,
            adapter: {
               type: "local",
               config: {
                  path: "./",
               },
            },
         });

         expect(config.enabled).toBe(true);
      }

      {
         // 2. create 'test' entity
         await app.module.data.schema().patch(
            "entities.test",
            proto
               .entity("test", {
                  content: proto.text(),
               })
               .toJSON(),
         );
         expect(app.em.entities.map((e) => e.name)).toContain("test");
      }

      {
         await app.module.data.schema().patch("entities.test.fields.files", {
            type: "media",
            config: {
               required: false,
               fillable: ["update"],
               hidden: false,
               mime_types: [],
               virtual: true,
               entity: "test",
            },
         });

         expect(
            app.module.data.schema().patch("relations.000", {
               type: "poly",
               source: "test",
               target: "media",
               config: { mappedBy: "files" },
            }),
         ).resolves.toBeDefined();
      }

      expect(app.em.entities.map((e) => e.name)).toEqual(["media", "test"]);
   });

   test.only("verify inversedBy", async () => {
      const schema = proto.em(
         {
            products: proto.entity("products", {
               title: proto.text(),
            }),
            product_likes: proto.entity("product_likes", {
               created_at: proto.date(),
            }),
            users: proto.entity("users", {}),
         },
         (fns, schema) => {
            fns.relation(schema.product_likes).manyToOne(schema.products, { inversedBy: "likes" });
            fns.relation(schema.product_likes).manyToOne(schema.users);
         },
      );
      const app = createApp({ initialConfig: { data: schema.toJSON() } });
      await app.build();

      const info = (await (await app.server.request("/api/data/info/products")).json()) as any;

      expect(info.fields).toEqual(["id", "title"]);
      expect(info.relations.listable).toEqual([
         {
            entity: "product_likes",
            ref: "likes",
         },
      ]);
   });
});
