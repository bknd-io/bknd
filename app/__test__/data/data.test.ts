import { afterAll, describe, expect, test } from "bun:test";
import { Entity, EntityManager } from "data/entities";
import { TextField, PrimaryField, NumberField } from "data/fields";
import { getDummyConnection } from "./helper";

const { dummyConnection, afterAllCleanup } = getDummyConnection();
afterAll(afterAllCleanup);

describe("some tests", async () => {
   //const connection = getLocalLibsqlConnection();
   const connection = dummyConnection;

   const users = new Entity("users", [
      new TextField("username", { required: true, default_value: "nobody" }),
      new TextField("email", { maxLength: 3 }),
   ]);

   const posts = new Entity("posts", [
      new TextField("title"),
      new TextField("content"),
      new TextField("created_at"),
      new NumberField("likes", { default_value: 0 }),
   ]);

   const em = new EntityManager([users, posts], connection);

   await em.schema().sync({ force: true });

   test("findId", async () => {
      const query = await em.repository(users).findId(1);

      expect(query.sql).toBe(
         'select "users"."id" as "id", "users"."username" as "username", "users"."email" as "email" from "users" where "id" = ? limit ?',
      );
      expect(query.parameters).toEqual([1, 1]);
      expect(query.data).toBeUndefined();
   });

   test("findMany", async () => {
      const query = await em.repository(users).findMany();

      expect(query.sql).toBe(
         'select "users"."id" as "id", "users"."username" as "username", "users"."email" as "email" from "users" order by "users"."id" asc limit ? offset ?',
      );
      expect(query.parameters).toEqual([10, 0]);
      expect(query.data).toEqual([]);
   });

   test("findMany with number", async () => {
      const query = await em.repository(posts).findMany();

      expect(query.sql).toBe(
         'select "posts"."id" as "id", "posts"."title" as "title", "posts"."content" as "content", "posts"."created_at" as "created_at", "posts"."likes" as "likes" from "posts" order by "posts"."id" asc limit ? offset ?',
      );
      expect(query.parameters).toEqual([10, 0]);
      expect(query.data).toEqual([]);
   });

   test("try adding an existing field name", async () => {
      expect(() => {
         new Entity("users", [
            new TextField("username"),
            new TextField("email"),
            new TextField("email"), // not throwing, it's just being ignored
         ]);
      }).toBeDefined();

      expect(() => {
         new Entity("users", [
            new TextField("username"),
            new TextField("email"),
            // field config differs, will throw
            new TextField("email", { required: true }),
         ]);
      }).toThrow();

      expect(() => {
         new Entity("users", [
            new PrimaryField(),
            new TextField("username"),
            new TextField("email"),
         ]);
      }).toBeDefined();
   });

   test("try adding duplicate entities", async () => {
      const entity = new Entity("users", [new TextField("username")]);
      const entity2 = new Entity("users", [new TextField("userna1me")]);

      expect(() => {
         // will not throw, just ignored
         new EntityManager([entity, entity], connection);
      }).toBeDefined();

      expect(() => {
         // the config differs, so it throws
         new EntityManager([entity, entity2], connection);
      }).toThrow();
   });

   test("primary uuid", async () => {
      const entity = new Entity("users", [
         new PrimaryField("id", { format: "uuid" }),
         new TextField("username"),
      ]);
      const em = new EntityManager([entity], getDummyConnection().dummyConnection);
      await em.schema().sync({ force: true });

      const mutator = em.mutator(entity);
      const data = await mutator.insertOne({ username: "test" });
      expect(data.data.id).toBeDefined();
      expect(data.data.id).toBeString();
   });
});
