import { afterAll, describe, expect, test } from "bun:test";
import {
   Entity,
   EntityManager,
   ManyToManyRelation,
   ManyToOneRelation,
   SchemaManager,
} from "../../../src/data";
import { UnableToConnectException } from "../../../src/data/errors";
import { getDummyConnection } from "../helper";

const { dummyConnection, afterAllCleanup } = getDummyConnection();
afterAll(afterAllCleanup);

describe("[data] EntityManager", async () => {
   test("base empty throw", async () => {
      // @ts-expect-error - testing invalid input, connection is required
      expect(() => new EntityManager([], {})).toThrow(UnableToConnectException);
   });

   test("base w/o entities & relations", async () => {
      const em = new EntityManager([], dummyConnection);
      expect(em.entities).toEqual([]);
      expect(em.relations.all).toEqual([]);
      expect(await em.ping()).toBe(true);
      expect(() => em.entity("...")).toThrow();
      expect(() =>
         em.addRelation(new ManyToOneRelation(new Entity("1"), new Entity("2"))),
      ).toThrow();
      expect(em.schema()).toBeInstanceOf(SchemaManager);

      // the rest will all throw, since they depend on em.entity()
   });

   test("w/ 2 entities but no initial relations", async () => {
      const users = new Entity("users");
      const posts = new Entity("posts");

      const em = new EntityManager([users, posts], dummyConnection);
      expect(em.entities).toEqual([users, posts]);
      expect(em.relations.all).toEqual([]);

      expect(em.entity("users")).toBe(users);
      expect(em.entity("posts")).toBe(posts);

      // expect adding relation to pass
      em.addRelation(new ManyToOneRelation(posts, users));
      expect(em.relations.all.length).toBe(1);
      expect(em.relations.all[0]).toBeInstanceOf(ManyToOneRelation);
      expect(em.relationsOf("users")).toEqual([em.relations.all[0]!]);
      expect(em.relationsOf("posts")).toEqual([em.relations.all[0]!]);
      expect(em.hasRelations("users")).toBe(true);
      expect(em.hasRelations("posts")).toBe(true);
      expect(em.relatedEntitiesOf("users")).toEqual([posts]);
      expect(em.relatedEntitiesOf("posts")).toEqual([users]);
      expect(em.relationReferencesOf("users")).toEqual(["posts"]);
      expect(em.relationReferencesOf("posts")).toEqual(["users"]);
   });

   test("test target relations", async () => {
      const users = new Entity("users");
      const posts = new Entity("posts");
      const comments = new Entity("comments");
      const categories = new Entity("categories");

      const em = new EntityManager([users, posts, comments, categories], dummyConnection);
      em.addRelation(new ManyToOneRelation(posts, users));
      em.addRelation(new ManyToOneRelation(comments, users));
      em.addRelation(new ManyToOneRelation(comments, posts));
      em.addRelation(new ManyToManyRelation(posts, categories));

      const userTargetRel = em.relations.targetRelationsOf(users);
      const postTargetRel = em.relations.targetRelationsOf(posts);
      const commentTargetRel = em.relations.targetRelationsOf(comments);

      expect(userTargetRel.map((r) => r.source.entity.name)).toEqual(["posts", "comments"]);
      expect(postTargetRel.map((r) => r.source.entity.name)).toEqual(["comments"]);
      expect(commentTargetRel.map((r) => r.source.entity.name)).toEqual([]);
   });

   test("test listable relations", async () => {
      const users = new Entity("users");
      const posts = new Entity("posts");
      const comments = new Entity("comments");
      const categories = new Entity("categories");

      const em = new EntityManager([users, posts, comments, categories], dummyConnection);
      em.addRelation(new ManyToOneRelation(posts, users));
      em.addRelation(new ManyToOneRelation(comments, users));
      em.addRelation(new ManyToOneRelation(comments, posts));
      em.addRelation(new ManyToManyRelation(posts, categories));

      const userTargetRel = em.relations.listableRelationsOf(users);
      const postTargetRel = em.relations.listableRelationsOf(posts);
      const commentTargetRel = em.relations.listableRelationsOf(comments);
      const categoriesTargetRel = em.relations.listableRelationsOf(categories);

      expect(userTargetRel.map((r) => r.other(users).entity.name)).toEqual(["posts", "comments"]);
      expect(postTargetRel.map((r) => r.other(posts).entity.name)).toEqual([
         "comments",
         "categories",
      ]);
      expect(commentTargetRel.map((r) => r.other(comments).entity.name)).toEqual([]);
      expect(categoriesTargetRel.map((r) => r.other(categories).entity.name)).toEqual(["posts"]);
   });
});
