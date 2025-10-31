import type { TestRunner } from "core/test";
import { Connection, type FieldSpec } from "./Connection";
import { getPath } from "bknd/utils";
import * as proto from "data/prototype";
import { createApp } from "App";
import type { MaybePromise } from "core/types";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";

// @todo: add various datatypes: string, number, boolean, object, array, null, undefined, date, etc.
// @todo: add toDriver/fromDriver tests on all types and fields

export function connectionTestSuite(
   testRunner: TestRunner,
   {
      makeConnection,
      rawDialectDetails,
      disableConsoleLog: _disableConsoleLog = true,
   }: {
      makeConnection: () => MaybePromise<{
         connection: Connection;
         dispose: () => MaybePromise<void>;
      }>;
      rawDialectDetails: string[];
      disableConsoleLog?: boolean;
   },
) {
   const { test, expect, describe, beforeEach, afterEach, afterAll, beforeAll } = testRunner;
   if (_disableConsoleLog) {
      beforeAll(() => disableConsoleLog());
      afterAll(() => enableConsoleLog());
   }

   let ctx: Awaited<ReturnType<typeof makeConnection>>;
   beforeEach(async () => {
      ctx = await makeConnection();
   });
   afterEach(async () => {
      await ctx.dispose();
   });

   describe("base", async () => {
      test("pings", async () => {
         const res = await ctx.connection.ping();
         expect(res).toBe(true);
      });

      test("initializes", async () => {
         await ctx.connection.init();
         // @ts-expect-error
         expect(ctx.connection.initialized).toBe(true);
         expect(ctx.connection.client).toBeDefined();
      });

      test("isConnection", async () => {
         expect(Connection.isConnection(ctx.connection)).toBe(true);
      });

      test("getFieldSchema", async () => {
         const specToNode = (spec: FieldSpec) => {
            const schema = ctx.connection.kysely.schema
               .createTable("test")
               // @ts-expect-error
               .addColumn(...ctx.connection.getFieldSchema(spec));
            return schema.toOperationNode();
         };

         {
            // primary
            const node = specToNode({
               type: "integer",
               name: "id",
               primary: true,
            });
            const col = node.columns[0]!;
            expect(col.primaryKey).toBe(true);
            expect(col.notNull).toBe(true);
         }

         {
            // normal
            const node = specToNode({
               type: "text",
               name: "text",
            });
            const col = node.columns[0]!;
            expect(!col.primaryKey).toBe(true);
            expect(!col.notNull).toBe(true);
         }

         {
            // nullable (expect to be same as normal)
            const node = specToNode({
               type: "text",
               name: "text",
               nullable: true,
            });
            const col = node.columns[0]!;
            expect(!col.primaryKey).toBe(true);
            expect(!col.notNull).toBe(true);
         }
      });
   });

   describe("schema", async () => {
      const makeSchema = async () => {
         const fields = [
            {
               type: "integer",
               name: "id",
               primary: true,
            },
            {
               type: "text",
               name: "text",
            },
            {
               type: "json",
               name: "json",
            },
         ] as const satisfies FieldSpec[];

         let b = ctx.connection.kysely.schema.createTable("test");
         for (const field of fields) {
            // @ts-expect-error
            b = b.addColumn(...ctx.connection.getFieldSchema(field));
         }
         await b.execute();

         // add index
         await ctx.connection.kysely.schema
            .createIndex("test_index")
            .on("test")
            .columns(["id"])
            .execute();
      };

      test("executes query", async () => {
         await makeSchema();
         await ctx.connection.kysely
            .insertInto("test")
            .values({ id: 1, text: "test", json: JSON.stringify({ a: 1 }) })
            .execute();

         const expected = { id: 1, text: "test", json: { a: 1 } };

         const qb = ctx.connection.kysely.selectFrom("test").selectAll();
         const res = await ctx.connection.executeQuery(qb);
         expect(res.rows).toEqual([expected]);
         expect(rawDialectDetails.every((detail) => getPath(res, detail) !== undefined)).toBe(true);

         {
            const res = await ctx.connection.executeQueries(qb, qb);
            expect(res.length).toBe(2);
            res.map((r) => {
               expect(r.rows).toEqual([expected]);
               expect(rawDialectDetails.every((detail) => getPath(r, detail) !== undefined)).toBe(
                  true,
               );
            });
         }
      });

      test("introspects", async () => {
         await makeSchema();
         const tables = await ctx.connection.getIntrospector().getTables({
            withInternalKyselyTables: false,
         });
         const clean = tables.map((t) => ({
            ...t,
            columns: t.columns
               .map((c) => ({
                  ...c,
                  // ignore data type
                  dataType: undefined,
                  // ignore default value if "id"
                  hasDefaultValue: c.name !== "id" ? c.hasDefaultValue : undefined,
               }))
               .sort((a, b) => a.name.localeCompare(b.name)),
         }));

         expect(clean).toEqual([
            {
               name: "test",
               isView: false,
               columns: [
                  {
                     name: "id",
                     dataType: undefined,
                     isNullable: false,
                     isAutoIncrementing: true,
                     hasDefaultValue: undefined,
                     comment: undefined,
                  },
                  {
                     name: "json",
                     dataType: undefined,
                     isNullable: true,
                     isAutoIncrementing: false,
                     hasDefaultValue: false,
                     comment: undefined,
                  },
                  {
                     name: "text",
                     dataType: undefined,
                     isNullable: true,
                     isAutoIncrementing: false,
                     hasDefaultValue: false,
                     comment: undefined,
                  },
               ],
            },
         ]);

         expect(await ctx.connection.getIntrospector().getIndices()).toEqual([
            {
               name: "test_index",
               table: "test",
               isUnique: false,
               columns: [
                  {
                     name: "id",
                     order: 0,
                  },
               ],
            },
         ]);
      });
   });

   describe("integration", async () => {
      let ctx: Awaited<ReturnType<typeof makeConnection>>;
      beforeEach(async () => {
         ctx = await makeConnection();
      });
      afterEach(async () => {
         await ctx.dispose();
      });

      test("should create app and ping", async () => {
         const app = createApp({
            connection: ctx.connection,
         });
         await app.build();

         expect(app.version()).toBeDefined();
         expect(await app.em.ping()).toBe(true);
      });

      test("should create a basic schema", async () => {
         const schema = proto.em(
            {
               posts: proto.entity("posts", {
                  title: proto.text().required(),
                  content: proto.text(),
               }),
               comments: proto.entity("comments", {
                  content: proto.text(),
               }),
            },
            (fns, s) => {
               fns.relation(s.comments).manyToOne(s.posts);
               fns.index(s.posts).on(["title"], true);
            },
         );

         const app = createApp({
            connection: ctx.connection,
            config: {
               data: schema.toJSON(),
            },
         });

         await app.build();

         expect(app.em.entities.length).toBe(2);
         expect(app.em.entities.map((e) => e.name)).toEqual(["posts", "comments"]);

         const api = app.getApi();

         expect(
            (
               await api.data.createMany("posts", [
                  {
                     title: "Hello",
                     content: "World",
                  },
                  {
                     title: "Hello 2",
                     content: "World 2",
                  },
               ])
            ).data,
         ).toEqual([
            {
               id: 1,
               title: "Hello",
               content: "World",
            },
            {
               id: 2,
               title: "Hello 2",
               content: "World 2",
            },
         ] as any);

         // try to create an existing
         expect(
            (
               await api.data.createOne("posts", {
                  title: "Hello",
               })
            ).ok,
         ).toBe(false);

         // add a comment to a post
         await api.data.createOne("comments", {
            content: "Hello",
            posts_id: 1,
         });

         // and then query using a `with` property
         const result = await api.data.readMany("posts", { with: ["comments"] });
         expect(result.length).toBe(2);
         expect(result[0]?.comments?.length).toBe(1);
         expect(result[0]?.comments?.[0]?.content).toBe("Hello");
         expect(result[1]?.comments?.length).toBe(0);
      });

      test("should support uuid", async () => {
         const schema = proto.em(
            {
               posts: proto.entity(
                  "posts",
                  {
                     title: proto.text().required(),
                     content: proto.text(),
                  },
                  {
                     primary_format: "uuid",
                  },
               ),
               comments: proto.entity("comments", {
                  content: proto.text(),
               }),
            },
            (fns, s) => {
               fns.relation(s.comments).manyToOne(s.posts);
               fns.index(s.posts).on(["title"], true);
            },
         );

         const app = createApp({
            connection: ctx.connection,
            config: {
               data: schema.toJSON(),
            },
         });

         await app.build();
         const config = app.toJSON();
         // @ts-expect-error
         expect(config.data.entities?.posts.fields?.id.config?.format).toBe("uuid");

         const em = app.em;
         const mutator = em.mutator(em.entity("posts"));
         const data = await mutator.insertOne({ title: "Hello", content: "World" });
         expect(data.data.id).toBeString();
         expect(String(data.data.id).length).toBe(36);
      });
   });
}
