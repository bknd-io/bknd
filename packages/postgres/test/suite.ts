import { describe, beforeAll, afterAll, expect, it, afterEach } from "bun:test";
import type { PostgresConnection } from "../src";
import { createApp, em, entity, text } from "bknd";
import { disableConsoleLog, enableConsoleLog } from "bknd/utils";
// @ts-ignore
import { connectionTestSuite } from "$bknd/data/connection/connection-test-suite";
// @ts-ignore
import { bunTestRunner } from "$bknd/adapter/bun/test";

export type TestSuiteConfig = {
   createConnection: () => InstanceType<typeof PostgresConnection>;
   cleanDatabase?: (connection: InstanceType<typeof PostgresConnection>) => Promise<void>;
};

export async function defaultCleanDatabase(connection: InstanceType<typeof PostgresConnection>) {
   const kysely = connection.kysely;

   // drop all tables+indexes & create new schema
   await kysely.schema.dropSchema("public").ifExists().cascade().execute();
   await kysely.schema.dropIndex("public").ifExists().cascade().execute();
   await kysely.schema.createSchema("public").execute();
}

async function cleanDatabase(
   connection: InstanceType<typeof PostgresConnection>,
   config: TestSuiteConfig,
) {
   if (config.cleanDatabase) {
      await config.cleanDatabase(connection);
   } else {
      await defaultCleanDatabase(connection);
   }
}

export function testSuite(config: TestSuiteConfig) {
   beforeAll(() => disableConsoleLog(["log", "warn", "error"]));
   afterAll(() => enableConsoleLog());

   // @todo: postgres seems to add multiple indexes, thus failing the test suite
   /* describe("test suite", () => {
      connectionTestSuite(bunTestRunner, {
         makeConnection: () => {
            const connection = config.createConnection();
            return {
               connection,
               dispose: async () => {
                  await cleanDatabase(connection, config);
                  await connection.close();
               },
            };
         },
         rawDialectDetails: [],
      });
   }); */

   describe("base", () => {
      it("should connect to the database", async () => {
         const connection = config.createConnection();
         expect(await connection.ping()).toBe(true);
      });

      it("should clean the database", async () => {
         const connection = config.createConnection();
         await cleanDatabase(connection, config);

         const tables = await connection.getIntrospector().getTables();
         expect(tables).toEqual([]);
      });
   });

   describe("integration", () => {
      let connection: PostgresConnection;
      beforeAll(async () => {
         connection = config.createConnection();
         await cleanDatabase(connection, config);
      });

      afterEach(async () => {
         await cleanDatabase(connection, config);
      });

      afterAll(async () => {
         await connection.close();
      });

      it("should create app and ping", async () => {
         const app = createApp({
            connection,
         });
         await app.build();

         expect(app.version()).toBeDefined();
         expect(await app.em.ping()).toBe(true);
      });

      it("should create a basic schema", async () => {
         const schema = em(
            {
               posts: entity("posts", {
                  title: text().required(),
                  content: text(),
               }),
               comments: entity("comments", {
                  content: text(),
               }),
            },
            (fns, s) => {
               fns.relation(s.comments).manyToOne(s.posts);
               fns.index(s.posts).on(["title"], true);
            },
         );

         const app = createApp({
            connection,
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
         expect(result[0].comments.length).toBe(1);
         expect(result[0].comments[0].content).toBe("Hello");
         expect(result[1].comments.length).toBe(0);
      });

      it("should support uuid", async () => {
         const schema = em(
            {
               posts: entity(
                  "posts",
                  {
                     title: text().required(),
                     content: text(),
                  },
                  {
                     primary_format: "uuid",
                  },
               ),
               comments: entity("comments", {
                  content: text(),
               }),
            },
            (fns, s) => {
               fns.relation(s.comments).manyToOne(s.posts);
               fns.index(s.posts).on(["title"], true);
            },
         );

         const app = createApp({
            connection,
            config: {
               data: schema.toJSON(),
            },
         });

         await app.build();
         const config = app.toJSON();
         // @ts-expect-error
         expect(config.data.entities?.posts.fields?.id.config?.format).toBe("uuid");

         const $em = app.em;
         const mutator = $em.mutator($em.entity("posts"));
         const data = await mutator.insertOne({ title: "Hello", content: "World" });
         expect(data.data.id).toBeString();
         expect(String(data.data.id).length).toBe(36);
      });
   });
}
