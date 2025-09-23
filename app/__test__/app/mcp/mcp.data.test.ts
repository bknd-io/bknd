import { describe, test, expect, beforeEach, beforeAll, afterAll } from "bun:test";
import { type App, createApp, createMcpToolCaller } from "core/test/utils";
import { getSystemMcp } from "modules/mcp/system-mcp";
import { pickKeys, type McpServer } from "bknd/utils";
import { entity, text } from "bknd";
import { disableConsoleLog, enableConsoleLog } from "core/utils";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

/**
 * - [ ] data_sync
 * - [x] data_entity_fn_count
 * - [x] data_entity_fn_exists
 * - [x] data_entity_read_one
 * - [x] data_entity_read_many
 * - [x] data_entity_insert
 * - [x] data_entity_update_many
 * - [x] data_entity_update_one
 * - [x] data_entity_delete_one
 * - [x] data_entity_delete_many
 * - [x] data_entity_info
 * - [ ] config_data_get
 * - [ ] config_data_update
 * - [x] config_data_entities_get
 * - [x] config_data_entities_add
 * - [x] config_data_entities_update
 * - [x] config_data_entities_remove
 * - [x] config_data_relations_add
 * - [x] config_data_relations_get
 * - [x] config_data_relations_update
 * - [x] config_data_relations_remove
 * - [x] config_data_indices_get
 * - [x] config_data_indices_add
 * - [x] config_data_indices_update
 * - [x] config_data_indices_remove
 */
describe("mcp data", async () => {
   let app: App;
   let server: McpServer;
   beforeEach(async () => {
      const time = performance.now();
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
      server.setLogLevel("error");
      server.onNotification((message) => {
         console.dir(message, { depth: null });
      });
   });

   const tool = createMcpToolCaller();

   test("config_data_entities_{add,get,update,remove}", async () => {
      const result = await tool(server, "config_data_entities_add", {
         key: "test",
         return_config: true,
         value: {},
      });
      expect(result.success).toBe(true);
      expect(result.module).toBe("data");
      expect(result.config.test?.type).toEqual("regular");

      const entities = Object.keys(app.toJSON().data.entities ?? {});
      expect(entities).toContain("test");

      {
         // get
         const result = await tool(server, "config_data_entities_get", {
            key: "test",
         });
         expect(result.module).toBe("data");
         expect(result.key).toBe("test");
         expect(result.value.type).toEqual("regular");
      }

      {
         // update
         const result = await tool(server, "config_data_entities_update", {
            key: "test",
            return_config: true,
            value: {
               config: {
                  name: "Test",
               },
            },
         });
         expect(result.success).toBe(true);
         expect(result.module).toBe("data");
         expect(result.config.test.config?.name).toEqual("Test");
         expect(app.toJSON().data.entities?.test?.config?.name).toEqual("Test");
      }

      {
         // remove
         const result = await tool(server, "config_data_entities_remove", {
            key: "test",
         });
         expect(result.success).toBe(true);
         expect(result.module).toBe("data");
         expect(app.toJSON().data.entities?.test).toBeUndefined();
      }
   });

   test("config_data_relations_{add,get,update,remove}", async () => {
      // create posts and comments
      await tool(server, "config_data_entities_add", {
         key: "posts",
         value: {},
      });
      await tool(server, "config_data_entities_add", {
         key: "comments",
         value: {},
      });

      expect(Object.keys(app.toJSON().data.entities ?? {})).toEqual(["posts", "comments"]);

      // create relation
      await tool(server, "config_data_relations_add", {
         key: "", // doesn't matter
         value: {
            type: "n:1",
            source: "comments",
            target: "posts",
         },
      });

      const config = app.toJSON().data;
      expect(
         pickKeys((config.relations?.n1_comments_posts as any) ?? {}, ["type", "source", "target"]),
      ).toEqual({
         type: "n:1",
         source: "comments",
         target: "posts",
      });

      expect(config.entities?.comments?.fields?.posts_id?.type).toBe("relation");

      {
         // info
         const postsInfo = await tool(server, "data_entity_info", {
            entity: "posts",
         });
         expect(postsInfo.fields).toEqual(["id"]);
         expect(postsInfo.relations.all.length).toBe(1);

         const commentsInfo = await tool(server, "data_entity_info", {
            entity: "comments",
         });
         expect(commentsInfo.fields).toEqual(["id", "posts_id"]);
         expect(commentsInfo.relations.all.length).toBe(1);
      }

      // update
      await tool(server, "config_data_relations_update", {
         key: "n1_comments_posts",
         value: {
            config: {
               with_limit: 10,
            },
         },
      });
      expect((app.toJSON().data.relations?.n1_comments_posts?.config as any)?.with_limit).toBe(10);

      // delete
      await tool(server, "config_data_relations_remove", {
         key: "n1_comments_posts",
      });
      expect(app.toJSON().data.relations?.n1_comments_posts).toBeUndefined();
   });

   test("config_data_indices_update", async () => {
      expect(server.tools.map((t) => t.name).includes("config_data_indices_update")).toBe(false);
   });

   test("config_data_indices_{add,get,remove}", async () => {
      // create posts and comments
      await tool(server, "config_data_entities_add", {
         key: "posts",
         value: entity("posts", {
            title: text(),
            content: text(),
         }).toJSON(),
      });

      // add index on title
      await tool(server, "config_data_indices_add", {
         key: "", // auto generated
         value: {
            entity: "posts",
            fields: ["title"],
         },
      });

      expect(app.toJSON().data.indices?.idx_posts_title).toEqual({
         entity: "posts",
         fields: ["title"],
         unique: false,
      });

      // delete
      await tool(server, "config_data_indices_remove", {
         key: "idx_posts_title",
      });
      expect(app.toJSON().data.indices?.idx_posts_title).toBeUndefined();
   });

   test("data_entity_*", async () => {
      // create posts and comments
      await tool(server, "config_data_entities_add", {
         key: "posts",
         value: entity("posts", {
            title: text(),
            content: text(),
         }).toJSON(),
      });
      await tool(server, "config_data_entities_add", {
         key: "comments",
         value: entity("comments", {
            content: text(),
         }).toJSON(),
      });

      // insert a few posts
      for (let i = 0; i < 10; i++) {
         await tool(server, "data_entity_insert", {
            entity: "posts",
            json: {
               title: `Post ${i}`,
            },
         });
      }
      // insert a few comments
      for (let i = 0; i < 5; i++) {
         await tool(server, "data_entity_insert", {
            entity: "comments",
            json: {
               content: `Comment ${i}`,
            },
         });
      }

      const result = await tool(server, "data_entity_read_many", {
         entity: "posts",
         limit: 5,
      });
      expect(result.data.length).toBe(5);
      expect(result.meta.items).toBe(5);
      expect(result.meta.total).toBe(10);
      expect(result.data[0].title).toBe("Post 0");

      {
         // count
         const result = await tool(server, "data_entity_fn_count", {
            entity: "posts",
         });
         expect(result.count).toBe(10);
      }

      {
         // exists
         const res = await tool(server, "data_entity_fn_exists", {
            entity: "posts",
            json: {
               id: result.data[0].id,
            },
         });
         expect(res.exists).toBe(true);

         const res2 = await tool(server, "data_entity_fn_exists", {
            entity: "posts",
            json: {
               id: "123",
            },
         });
         expect(res2.exists).toBe(false);
      }

      // update
      await tool(server, "data_entity_update_one", {
         entity: "posts",
         id: result.data[0].id,
         json: {
            title: "Post 0 updated",
         },
      });
      const result2 = await tool(server, "data_entity_read_one", {
         entity: "posts",
         id: result.data[0].id,
      });
      expect(result2.data.title).toBe("Post 0 updated");

      // delete the second post
      await tool(server, "data_entity_delete_one", {
         entity: "posts",
         id: result.data[1].id,
      });
      const result3 = await tool(server, "data_entity_read_many", {
         entity: "posts",
         limit: 2,
      });
      expect(result3.data.map((p) => p.id)).toEqual([1, 3]);

      // update many
      await tool(server, "data_entity_update_many", {
         entity: "posts",
         update: {
            title: "Post updated",
         },
         where: {
            title: { $isnull: 0 },
         },
      });
      const result4 = await tool(server, "data_entity_read_many", {
         entity: "posts",
         limit: 10,
      });
      expect(result4.data.length).toBe(9);
      expect(result4.data.map((p) => p.title)).toEqual(
         Array.from({ length: 9 }, () => "Post updated"),
      );

      // delete many
      await tool(server, "data_entity_delete_many", {
         entity: "posts",
         json: {
            title: { $isnull: 0 },
         },
      });
      const result5 = await tool(server, "data_entity_read_many", {
         entity: "posts",
         limit: 10,
      });
      expect(result5.data.length).toBe(0);
      expect(result5.meta.items).toBe(0);
      expect(result5.meta.total).toBe(0);
   });
});
