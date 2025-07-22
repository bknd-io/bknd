import { afterAll, describe, expect, test } from "bun:test";
import { Entity, EntityManager } from "data/entities";
import { ManyToOneRelation } from "data/relations";
import { TextField } from "data/fields";
import { JoinBuilder } from "data/entities/query/JoinBuilder";
import { getDummyConnection } from "../helper";

const { dummyConnection, afterAllCleanup } = getDummyConnection();
afterAll(afterAllCleanup);

describe("[data] JoinBuilder", async () => {
   test("missing relation", async () => {
      const users = new Entity("users", [new TextField("username")]);
      const em = new EntityManager([users], dummyConnection);

      expect(() =>
         JoinBuilder.addClause(em, em.connection.kysely.selectFrom("users"), users, ["posts"]),
      ).toThrow('Relation "posts" not found');
   });

   test("addClause: ManyToOne", async () => {
      const users = new Entity("users", [new TextField("username")]);
      const posts = new Entity("posts", [new TextField("content")]);
      const relations = [new ManyToOneRelation(posts, users, { mappedBy: "author" })];
      const em = new EntityManager([users, posts], dummyConnection, relations);

      const qb = JoinBuilder.addClause(em, em.connection.kysely.selectFrom("users"), users, [
         "posts",
      ]);

      const res = qb.compile();
      console.log("compiled", res.sql);

      /*expect(res.sql).toBe(
         'select from "users" inner join "posts" on "posts"."author_id" = "users"."id" group by "users"."id"',
      );*/

      const qb2 = JoinBuilder.addClause(em, em.connection.kysely.selectFrom("posts"), posts, [
         "author",
      ]);

      const res2 = qb2.compile();
      console.log("compiled2", res2.sql);
   });
});
