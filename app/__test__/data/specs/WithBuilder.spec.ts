import { describe, expect, test } from "bun:test";
import { Entity, EntityManager } from "data/entities";
import { ManyToManyRelation, ManyToOneRelation, PolymorphicRelation } from "data/relations";
import { TextField } from "data/fields";
import * as proto from "data/prototype";
import { WithBuilder } from "data/entities/query/WithBuilder";
import { schemaToEm } from "../../helper";
import { getDummyConnection } from "../helper";

const { dummyConnection } = getDummyConnection();

describe("[data] WithBuilder", async () => {
   test("validate withs", async () => {
      const schema = proto.em(
         {
            posts: proto.entity("posts", {}),
            users: proto.entity("users", {}),
            media: proto.entity("media", {}),
         },
         ({ relation }, { posts, users, media }) => {
            relation(posts).manyToOne(users);
            relation(users).polyToOne(media, { mappedBy: "avatar" });
         },
      );
      const em = schemaToEm(schema);

      expect(WithBuilder.validateWiths(em, "posts", undefined as any)).toBe(0);
      expect(WithBuilder.validateWiths(em, "posts", {})).toBe(0);
      expect(WithBuilder.validateWiths(em, "posts", { users: {} })).toBe(1);
      expect(
         WithBuilder.validateWiths(em, "posts", {
            users: {
               with: { avatar: {} },
            },
         }),
      ).toBe(2);
      expect(() => WithBuilder.validateWiths(em, "posts", { author: {} })).toThrow();
      expect(() =>
         WithBuilder.validateWiths(em, "posts", {
            users: {
               with: { glibberish: {} },
            },
         }),
      ).toThrow();
   });

   test("missing relation", async () => {
      const users = new Entity("users", [new TextField("username")]);
      const em = new EntityManager([users], dummyConnection);

      expect(() =>
         WithBuilder.addClause(em, em.connection.kysely.selectFrom("users"), users, {
            posts: {},
         }),
      ).toThrow('Relation "users<>posts" not found');
   });

   test("addClause: ManyToOne", async () => {
      const users = new Entity("users", [new TextField("username")]);
      const posts = new Entity("posts", [new TextField("content")]);
      const relations = [new ManyToOneRelation(posts, users, { mappedBy: "author" })];
      const em = new EntityManager([users, posts], dummyConnection, relations);

      const qb = WithBuilder.addClause(em, em.connection.kysely.selectFrom("users"), users, {
         posts: {},
      });

      const res = qb.compile();

      expect(res.sql).toBe(
         'select (select coalesce(json_group_array(json_object(\'id\', "agg"."id", \'content\', "agg"."content", \'author_id\', "agg"."author_id")), \'[]\') from (select "posts"."id" as "id", "posts"."content" as "content", "posts"."author_id" as "author_id" from "posts" as "posts" where "posts"."author_id" = "users"."id" order by "posts"."id" asc limit ? offset ?) as agg) as "posts" from "users"',
      );
      expect(res.parameters).toEqual([10, 0]);

      const qb2 = WithBuilder.addClause(
         em,
         em.connection.kysely.selectFrom("posts"),
         posts, // @todo: try with "users", it gives output!
         {
            author: {},
         },
      );

      const res2 = qb2.compile();

      expect(res2.sql).toBe(
         'select (select json_object(\'id\', "obj"."id", \'username\', "obj"."username") from (select "users"."id" as "id", "users"."username" as "username" from "users" as "author" where "author"."id" = "posts"."author_id" order by "users"."id" asc limit ?) as obj) as "author" from "posts"',
      );
      expect(res2.parameters).toEqual([1]);
   });

   test("test with empty join", async () => {
      const em = new EntityManager([], dummyConnection);
      const qb = { qb: 1 } as any;

      expect(WithBuilder.addClause(em, qb, null as any, {})).toBe(qb);
   });

   test("test manytomany", async () => {
      const posts = new Entity("posts", [new TextField("title")]);
      const categories = new Entity("categories", [new TextField("label")]);

      const entities = [posts, categories];
      const relations = [new ManyToManyRelation(posts, categories)];

      const em = new EntityManager(entities, dummyConnection, relations);
      await em.schema().sync({ force: true });

      await em.mutator(posts).insertOne({ title: "fashion post" });
      await em.mutator(posts).insertOne({ title: "beauty post" });

      await em.mutator(categories).insertOne({ label: "fashion" });
      await em.mutator(categories).insertOne({ label: "beauty" });
      await em.mutator(categories).insertOne({ label: "tech" });

      await em.connection.kysely
         .insertInto("posts_categories")
         .values([
            { posts_id: 1, categories_id: 1 },
            { posts_id: 2, categories_id: 2 },
            { posts_id: 1, categories_id: 2 },
         ])
         .execute();

      //console.log((await em.repository().findMany("posts_categories")).result);

      const res = await em.repository(posts).findMany({ with: { categories: {} } });

      expect(res.data).toEqual([
         {
            id: 1,
            title: "fashion post",
            categories: [
               { id: 1, label: "fashion" },
               { id: 2, label: "beauty" },
            ],
         },
         {
            id: 2,
            title: "beauty post",
            categories: [{ id: 2, label: "beauty" }],
         },
      ]);

      const res2 = await em.repository(categories).findMany({ with: { posts: {} } });

      //console.log(res2.sql, res2.data);

      expect(res2.data).toEqual([
         {
            id: 1,
            label: "fashion",
            posts: [{ id: 1, title: "fashion post" }],
         },
         {
            id: 2,
            label: "beauty",
            posts: [
               { id: 1, title: "fashion post" },
               { id: 2, title: "beauty post" },
            ],
         },
         {
            id: 3,
            label: "tech",
            posts: [],
         },
      ]);
   });

   test("polymorphic", async () => {
      const categories = new Entity("categories", [new TextField("name")]);
      const media = new Entity("media", [new TextField("path")]);

      const entities = [media, categories];
      const single = new PolymorphicRelation(categories, media, {
         mappedBy: "single",
         targetCardinality: 1,
      });
      const multiple = new PolymorphicRelation(categories, media, { mappedBy: "multiple" });

      const em = new EntityManager(entities, dummyConnection, [single, multiple]);

      const qb = WithBuilder.addClause(
         em,
         em.connection.kysely.selectFrom("categories"),
         categories,
         { single: {} },
      );
      const res = qb.compile();
      expect(res.sql).toBe(
         'select (select json_object(\'id\', "obj"."id", \'path\', "obj"."path") from (select "media"."id" as "id", "media"."path" as "path" from "media" where "media"."reference" = ? and "categories"."id" = "media"."entity_id" order by "media"."id" asc limit ?) as obj) as "single" from "categories"',
      );
      expect(res.parameters).toEqual(["categories.single", 1]);

      const qb2 = WithBuilder.addClause(
         em,
         em.connection.kysely.selectFrom("categories"),
         categories,
         { multiple: {} },
      );
      const res2 = qb2.compile();
      expect(res2.sql).toBe(
         'select (select coalesce(json_group_array(json_object(\'id\', "agg"."id", \'path\', "agg"."path")), \'[]\') from (select "media"."id" as "id", "media"."path" as "path" from "media" where "media"."reference" = ? and "categories"."id" = "media"."entity_id" order by "media"."id" asc limit ? offset ?) as agg) as "multiple" from "categories"',
      );
      expect(res2.parameters).toEqual(["categories.multiple", 10, 0]);
   });

   /*test("test manytoone", async () => {
      const posts = new Entity("posts", [new TextField("title")]);
      const users = new Entity("users", [new TextField("username")]);
      const relations = [
         new ManyToOneRelation(posts, users, { mappedBy: "author" }),
      ];
      const em = new EntityManager([users, posts], dummyConnection, relations);
      console.log((await em.schema().sync(true)).map((s) => s.sql).join("\n"));
      await em.schema().sync();

      await em.mutator().insertOne("users", { username: "user1" });
      await em.mutator().insertOne("users", { username: "user2" });

      await em.mutator().insertOne("posts", { title: "post1", author_id: 1 });
      await em.mutator().insertOne("posts", { title: "post2", author_id: 2 });

      console.log((await em.repository().findMany("posts")).result);

      const res = await em.repository().findMany("posts", { join: ["author"] });
      console.log(res.sql, res.parameters, res.result);
   });*/

   describe("recursive", () => {
      test("compiles with singles", async () => {
         const schema = proto.em(
            {
               posts: proto.entity("posts", {}),
               users: proto.entity("users", {
                  username: proto.text(),
               }),
               media: proto.entity("media", {
                  path: proto.text(),
               }),
            },
            ({ relation }, { posts, users, media }) => {
               relation(posts).manyToOne(users);
               relation(users).polyToOne(media, { mappedBy: "avatar" });
            },
         );
         const em = schemaToEm(schema);

         const qb = WithBuilder.addClause(
            em,
            em.connection.kysely.selectFrom("posts"),
            schema.entities.posts,
            {
               users: {
                  limit: 5, // ignored
                  select: ["id", "username"],
                  sort: { by: "username", dir: "asc" },
                  with: {
                     avatar: {
                        select: ["id", "path"],
                        limit: 2, // ignored
                     },
                  },
               },
            },
         );

         //prettyPrintQb(qb);
         expect(qb.compile().sql).toBe(
            'select (select json_object(\'id\', "obj"."id", \'username\', "obj"."username", \'avatar\', "obj"."avatar") from (select "users"."id" as "id", "users"."username" as "username", (select json_object(\'id\', "obj"."id", \'path\', "obj"."path") from (select "media"."id" as "id", "media"."path" as "path" from "media" where "media"."reference" = ? and "users"."id" = "media"."entity_id" order by "media"."id" asc limit ?) as obj) as "avatar" from "users" as "users" where "users"."id" = "posts"."users_id" order by "users"."username" asc limit ?) as obj) as "users" from "posts"',
         );
         expect(qb.compile().parameters).toEqual(["users.avatar", 1, 1]);
      });

      test("compiles with many", async () => {
         const schema = proto.em(
            {
               posts: proto.entity("posts", {}),
               comments: proto.entity("comments", {}),
               users: proto.entity("users", {
                  username: proto.text(),
               }),
               media: proto.entity("media", {
                  path: proto.text(),
               }),
            },
            ({ relation }, { posts, comments, users, media }) => {
               relation(posts).manyToOne(users).polyToOne(media, { mappedBy: "images" });
               relation(users).polyToOne(media, { mappedBy: "avatar" });
               relation(comments).manyToOne(posts).manyToOne(users);
            },
         );
         const em = schemaToEm(schema);

         const qb = WithBuilder.addClause(
            em,
            em.connection.kysely.selectFrom("posts"),
            schema.entities.posts,
            {
               comments: {
                  limit: 12,
                  with: {
                     users: {
                        select: ["username"],
                     },
                  },
               },
            },
         );

         expect(qb.compile().sql).toBe(
            'select (select coalesce(json_group_array(json_object(\'id\', "agg"."id", \'posts_id\', "agg"."posts_id", \'users_id\', "agg"."users_id", \'users\', "agg"."users")), \'[]\') from (select "comments"."id" as "id", "comments"."posts_id" as "posts_id", "comments"."users_id" as "users_id", (select json_object(\'username\', "obj"."username") from (select "users"."username" as "username" from "users" as "users" where "users"."id" = "comments"."users_id" order by "users"."id" asc limit ?) as obj) as "users" from "comments" as "comments" where "comments"."posts_id" = "posts"."id" order by "comments"."id" asc limit ? offset ?) as agg) as "comments" from "posts"',
         );
         expect(qb.compile().parameters).toEqual([1, 12, 0]);
      });

      test("returns correct result", async () => {
         const schema = proto.em(
            {
               posts: proto.entity("posts", {
                  title: proto.text(),
               }),
               comments: proto.entity("comments", {
                  content: proto.text(),
               }),
               users: proto.entity("users", {
                  username: proto.text(),
               }),
               media: proto.entity("media", {
                  path: proto.text(),
               }),
            },
            ({ relation }, { posts, comments, users, media }) => {
               relation(posts).manyToOne(users).polyToOne(media, { mappedBy: "images" });
               relation(users).polyToOne(media, { mappedBy: "avatar" });
               relation(comments).manyToOne(posts).manyToOne(users);
            },
         );
         const em = schemaToEm(schema);
         await em.schema().sync({ force: true });

         // add data
         await em.mutator("users").insertMany([{ username: "user1" }, { username: "user2" }]);
         await em.mutator("posts").insertMany([
            { title: "post1", users_id: 1 },
            { title: "post2", users_id: 1 },
            { title: "post3", users_id: 2 },
         ]);
         await em.mutator("comments").insertMany([
            { content: "comment1", posts_id: 1, users_id: 1 },
            { content: "comment1-1", posts_id: 1, users_id: 1 },
            { content: "comment2", posts_id: 1, users_id: 2 },
            { content: "comment3", posts_id: 2, users_id: 1 },
            { content: "comment4", posts_id: 2, users_id: 2 },
            { content: "comment5", posts_id: 3, users_id: 1 },
            { content: "comment6", posts_id: 3, users_id: 2 },
         ]);

         const result = await em.repo("posts").findMany({
            select: ["title"],
            with: {
               comments: {
                  limit: 2,
                  select: ["content"],
                  with: {
                     users: {
                        select: ["username"],
                     },
                  },
               },
            },
         });

         expect(result.data).toEqual([
            {
               title: "post1",
               comments: [
                  {
                     content: "comment1",
                     users: {
                        username: "user1",
                     },
                  },
                  {
                     content: "comment1-1",
                     users: {
                        username: "user1",
                     },
                  },
               ],
            },
            {
               title: "post2",
               comments: [
                  {
                     content: "comment3",
                     users: {
                        username: "user1",
                     },
                  },
                  {
                     content: "comment4",
                     users: {
                        username: "user2",
                     },
                  },
               ],
            },
            {
               title: "post3",
               comments: [
                  {
                     content: "comment5",
                     users: {
                        username: "user1",
                     },
                  },
                  {
                     content: "comment6",
                     users: {
                        username: "user2",
                     },
                  },
               ],
            },
         ]);
         //console.log(_jsonp(result.data));
      });
   });
});
