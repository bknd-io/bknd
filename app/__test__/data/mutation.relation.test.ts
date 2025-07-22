// eslint-disable-next-line import/no-unresolved
import { afterAll, describe, expect, test } from "bun:test";
import { Entity } from "data/entities";
import { EntityManager } from "data/entities/EntityManager";
import { ManyToOneRelation } from "data/relations";
import { NumberField, TextField } from "data/fields";
import { SchemaManager } from "data/schema/SchemaManager";
import { getDummyConnection } from "./helper";

const { dummyConnection, afterAllCleanup } = getDummyConnection();
afterAll(afterAllCleanup);

describe("Mutator relation", async () => {
   const connection = dummyConnection;
   //const connection = getLocalLibsqlConnection();
   //const connection = getCreds("DB_DATA");

   const posts = new Entity("posts", [
      new TextField("title"),
      new TextField("content", { default_value: "..." }),
      new NumberField("count", { default_value: 0 }),
   ]);

   const users = new Entity("users", [new TextField("username")]);

   const relations = [new ManyToOneRelation(posts, users)];

   const em = new EntityManager([posts, users], connection, relations);

   const schema = new SchemaManager(em);
   await schema.sync({ force: true });

   test("add users", async () => {
      const { data } = await em.mutator(users).insertOne({ username: "user1" });
      await em.mutator(users).insertOne({ username: "user2" });

      // create some posts
      await em.mutator(posts).insertOne({ title: "post1", content: "content1" });

      // expect to throw
      expect(em.mutator(posts).insertOne({ title: "post2", users_id: 10 })).rejects.toThrow();

      expect(
         em.mutator(posts).insertOne({ title: "post2", users_id: data.id }),
      ).resolves.toBeDefined();
   });
});
