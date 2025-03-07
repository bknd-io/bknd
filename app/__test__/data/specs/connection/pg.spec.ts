import { describe, expect, test } from "bun:test";
import { createApp } from "App";
import { PostgresConnection } from "data/connection/postgres/PostgresConnection";
import * as proto from "data/prototype";
import { PostgresIntrospector } from "data/connection/postgres/PostgresIntrospector";
import { ParseJSONResultsPlugin } from "kysely";

const connection = new PostgresConnection({
   database: "test",
   host: "localhost",
   user: "root",
   password: "1234",
   port: 5433,
});

const ALL_TESTS = !!process.env.ALL_TESTS;

describe.skipIf(ALL_TESTS)("postgres", () => {
   test.skip("introspector", async () => {
      const introspector = new PostgresIntrospector(connection.kysely, {
         plugins: [new ParseJSONResultsPlugin()],
      });

      console.log(await introspector.getSchemaSpec());
   });

   test("builds", async () => {
      const schema = proto.em(
         {
            posts: proto.entity("posts", {
               title: proto.text().required(),
            }),
            comments: proto.entity("comments", {
               text: proto.text(),
            }),
         },
         (ctx, s) => {
            ctx.relation(s.comments).manyToOne(s.posts);
            ctx.index(s.posts).on(["title"], true);
            ctx.index(s.comments).on(["text"]);
         },
      );

      const app = createApp({
         initialConfig: {
            data: schema.toJSON(),
         },
         connection,
      });

      await app.build({ sync: true });

      /*await app.em
         .mutator("posts")
         .insertMany([{ title: "hello world" }, { title: "hello world 2" }]);*/

      expect(app.version()).toBeDefined();
      console.log(await app.em.repo("posts").findMany());
   });
});
