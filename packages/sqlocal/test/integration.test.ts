import { describe, expect, it } from "bun:test";
import { SQLocalConnection } from "../src";
import { createApp, em, entity, text } from "bknd";
import type { ClientConfig } from "sqlocal";
import { SQLocalKysely } from "sqlocal/kysely";

describe("integration", () => {
   function create(config: ClientConfig = { databasePath: ":memory:" }) {
      return new SQLocalConnection(new SQLocalKysely(config));
   }

   it("should create app and ping", async () => {
      const app = createApp({
         connection: create(),
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
         connection: create(),
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
});
