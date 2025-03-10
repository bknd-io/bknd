// eslint-disable-next-line import/no-unresolved
import { afterAll, describe, expect, test } from "bun:test";
import { Entity, EntityManager, TextField } from "../../src/data";
import {
   ManyToManyRelation,
   ManyToOneRelation,
   OneToOneRelation,
   PolymorphicRelation,
   RelationField,
} from "../../src/data/relations";
import { getDummyConnection } from "./helper";

const { dummyConnection, afterAllCleanup } = getDummyConnection();
afterAll(afterAllCleanup);

describe("Relations", async () => {
   test("RelationField", async () => {
      const em = new EntityManager([], dummyConnection);
      const schema = em.connection.kysely.schema;

      //const r1 = new RelationField(new Entity("users"));
      const r1 = new RelationField("users_id", {
         reference: "users",
         target: "users",
         target_field: "id",
      });

      const sql1 = schema
         .createTable("posts")
         .addColumn(...em.connection.getFieldSchema(r1.schema())!)
         .compile().sql;

      expect(sql1).toBe(
         'create table "posts" ("users_id" integer references "users" ("id") on delete set null)',
      );

      //const r2 = new RelationField(new Entity("users"), "author");
      const r2 = new RelationField("author_id", {
         reference: "author",
         target: "users",
         target_field: "id",
      });

      const sql2 = schema
         .createTable("posts")
         .addColumn(...em.connection.getFieldSchema(r2.schema())!)
         .compile().sql;

      expect(sql2).toBe(
         'create table "posts" ("author_id" integer references "users" ("id") on delete set null)',
      );
   });

   test("Required RelationField", async () => {
      //const r1 = new RelationField(new Entity("users"), undefined, { required: true });
      const r1 = new RelationField("users_id", {
         reference: "users",
         target: "users",
         target_field: "id",
         required: true,
      });
      expect(r1.isRequired()).toBeTrue();
   });

   test("ManyToOne", async () => {
      const users = new Entity("users", [new TextField("username")]);
      const posts = new Entity("posts", [
         new TextField("title", {
            maxLength: 2,
         }),
      ]);

      const entities = [users, posts];

      const relationName = "author";
      const relations = [new ManyToOneRelation(posts, users, { mappedBy: relationName })];
      const em = new EntityManager(entities, dummyConnection, relations);

      // verify naming
      const rel = em.relations.all[0];
      expect(rel.source.entity.name).toBe(posts.name);
      expect(rel.source.reference).toBe(posts.name);
      expect(rel.target.entity.name).toBe(users.name);
      expect(rel.target.reference).toBe(relationName);

      // verify field
      expect(posts.field(relationName + "_id")).toBeInstanceOf(RelationField);

      // verify low level relation
      expect(em.relationsOf(users.name).length).toBe(1);
      expect(em.relationsOf(users.name).length).toBe(1);
      expect(em.relationsOf(users.name)[0].source.entity).toBe(posts);
      expect(posts.field("author_id")).toBeInstanceOf(RelationField);
      expect(em.relationsOf(users.name).length).toBe(1);
      expect(em.relationsOf(users.name).length).toBe(1);
      expect(em.relationsOf(users.name)[0].source.entity).toBe(posts);

      // verify high level relation (from users)
      const userPostsRel = em.relationOf(users.name, "posts");
      expect(userPostsRel).toBeInstanceOf(ManyToOneRelation);
      expect(userPostsRel?.other(users).entity).toBe(posts);

      // verify high level relation (from posts)
      const postAuthorRel = em.relationOf(posts.name, "author")! as ManyToOneRelation;
      expect(postAuthorRel).toBeInstanceOf(ManyToOneRelation);
      expect(postAuthorRel?.other(posts).entity).toBe(users);

      const kysely = em.connection.kysely;
      /**
       * Relation Helper
       */
      /**
       * FROM POSTS
       * ----------
       - lhs: posts.author_id
       - rhs: users.id
       - as: author
       - select: users.*
       - cardinality: 1
       */
      const selectPostsFromUsers = kysely
         .selectFrom(users.name)
         .select((eb) => postAuthorRel.buildWith(users, "posts")(eb).as("posts"));
      expect(selectPostsFromUsers.compile().sql).toBe(
         'select (select from "posts" as "posts" where "posts"."author_id" = "users"."id") as "posts" from "users"',
      );
      expect(postAuthorRel!.getField()).toBeInstanceOf(RelationField);
      const userObj = { id: 1, username: "test" };
      expect(postAuthorRel.hydrate(users, [userObj], em)).toEqual(userObj);

      /**
       FROM USERS
       ----------
       - lhs: posts.author_id
       - rhs: users.id
       - as: posts
       - select: posts.*
       - cardinality:
       */
      const selectUsersFromPosts = kysely
         .selectFrom(posts.name)
         .select((eb) => postAuthorRel.buildWith(posts, "author")(eb).as("author"));

      expect(selectUsersFromPosts.compile().sql).toBe(
         'select (select from "users" as "author" where "author"."id" = "posts"."author_id" limit ?) as "author" from "posts"',
      );
      expect(postAuthorRel.getField()).toBeInstanceOf(RelationField);
      const postObj = { id: 1, title: "test" };
      expect(postAuthorRel.hydrate(posts, [postObj], em)).toEqual([postObj]);

      // mutation info
      expect(postAuthorRel!.helper(users.name)!.getMutationInfo()).toEqual({
         reference: "posts",
         local_field: undefined,
         $set: false,
         $create: false,
         $attach: false,
         $detach: false,
         primary: undefined,
         cardinality: undefined,
         relation_type: "n:1",
      });

      expect(postAuthorRel!.helper(posts.name)!.getMutationInfo()).toEqual({
         reference: "author",
         local_field: "author_id",
         $set: true,
         $create: false,
         $attach: false,
         $detach: false,
         primary: "id",
         cardinality: 1,
         relation_type: "n:1",
      });

      /*console.log("ManyToOne (source=posts, target=users)");
      // prettier-ignore
      console.log("users perspective",postAuthorRel!.helper(users.name)!.getMutationInfo());
      // prettier-ignore
      console.log("posts perspective", postAuthorRel!.helper(posts.name)!.getMutationInfo());
      console.log("");*/
   });

   test("OneToOne", async () => {
      const users = new Entity("users", [new TextField("username")]);
      const settings = new Entity("settings", [new TextField("theme")]);

      const entities = [users, settings];
      const relations = [new OneToOneRelation(users, settings)];

      const em = new EntityManager(entities, dummyConnection, relations);

      // verify naming
      const rel = em.relations.all[0];
      expect(rel.source.entity.name).toBe(users.name);
      expect(rel.source.reference).toBe(users.name);
      expect(rel.target.entity.name).toBe(settings.name);
      expect(rel.target.reference).toBe(settings.name);

      // verify fields (only one added to users (source))
      expect(users.field("settings_id")).toBeInstanceOf(RelationField);

      expect(em.relationsOf(users.name).length).toBe(1);
      expect(em.relationsOf(users.name).length).toBe(1);
      expect(em.relationsOf(users.name)[0].source.entity).toBe(users);
      expect(em.relationsOf(users.name)[0].target.entity).toBe(settings);

      // verify high level relation (from users)
      const userSettingRel = em.relationOf(users.name, settings.name);
      expect(userSettingRel).toBeInstanceOf(OneToOneRelation);
      expect(userSettingRel?.other(users).entity.name).toBe(settings.name);

      // verify high level relation (from settings)
      const settingUserRel = em.relationOf(settings.name, users.name);
      expect(settingUserRel).toBeInstanceOf(OneToOneRelation);
      expect(settingUserRel?.other(settings).entity.name).toBe(users.name);

      // mutation info
      expect(userSettingRel!.helper(users.name)!.getMutationInfo()).toEqual({
         reference: "settings",
         local_field: "settings_id",
         $set: true,
         $create: true,
         $attach: false,
         $detach: false,
         primary: "id",
         cardinality: 1,
         relation_type: "1:1",
      });
      expect(userSettingRel!.helper(settings.name)!.getMutationInfo()).toEqual({
         reference: "users",
         local_field: undefined,
         $set: false,
         $create: false,
         $attach: false,
         $detach: false,
         primary: undefined,
         cardinality: 1,
         relation_type: "1:1",
      });

      /*console.log("");
      console.log("OneToOne (source=users, target=settings)");
      // prettier-ignore
      console.log("users perspective",userSettingRel!.helper(users.name)!.getMutationInfo());
      // prettier-ignore
      console.log("settings perspective", userSettingRel!.helper(settings.name)!.getMutationInfo());
      console.log("");*/
   });

   test("ManyToMany", async () => {
      const posts = new Entity("posts", [new TextField("title")]);
      const categories = new Entity("categories", [new TextField("label")]);

      const entities = [posts, categories];
      const relations = [new ManyToManyRelation(posts, categories)];

      const em = new EntityManager(entities, dummyConnection, relations);

      //console.log((await em.schema().sync(true)).map((s) => s.sql).join(";\n"));

      // don't expect new fields bc of connection table
      expect(posts.getFields().length).toBe(2);
      expect(categories.getFields().length).toBe(2);

      // expect relations set
      expect(em.relationsOf(posts.name).length).toBe(1);
      expect(em.relationsOf(categories.name).length).toBe(1);

      // expect connection table with fields
      expect(em.entity("posts_categories")).toBeInstanceOf(Entity);
      expect(em.entity("posts_categories").getFields().length).toBe(3);
      expect(em.entity("posts_categories").field("posts_id")).toBeInstanceOf(RelationField);
      expect(em.entity("posts_categories").field("categories_id")).toBeInstanceOf(RelationField);

      // verify high level relation (from posts)
      const postCategoriesRel = em.relationOf(posts.name, categories.name);
      expect(postCategoriesRel).toBeInstanceOf(ManyToManyRelation);
      expect(postCategoriesRel?.other(posts).entity.name).toBe(categories.name);

      //console.log("relation", postCategoriesRel);

      // verify high level relation (from posts)
      const categoryPostsRel = em.relationOf(categories.name, posts.name);
      expect(categoryPostsRel).toBeInstanceOf(ManyToManyRelation);
      expect(categoryPostsRel?.other(categories.name).entity.name).toBe(posts.name);

      // now get connection table from relation (from posts)
      if (postCategoriesRel instanceof ManyToManyRelation) {
         expect(postCategoriesRel.connectionEntity.name).toBe("posts_categories");
         expect(em.entity(postCategoriesRel.connectionEntity.name).name).toBe("posts_categories");
      } else {
         throw new Error("Expected ManyToManyRelation");
      }

      /**
       * Relation Helper
       */
      const kysely = em.connection.kysely;
      const jsonFrom = (e) => e;

      /**
       * FROM POSTS
       * ----------
       - lhs: posts.author_id
       - rhs: users.id
       - as: author
       - select: users.*
       - cardinality: 1
       */
      const selectCategoriesFromPosts = kysely
         .selectFrom(posts.name)
         .select((eb) => postCategoriesRel.buildWith(posts)(eb).select("id").as("categories"));
      expect(selectCategoriesFromPosts.compile().sql).toBe(
         'select (select "id" from "categories" inner join "posts_categories" on "categories"."id" = "posts_categories"."categories_id" where "posts"."id" = "posts_categories"."posts_id" limit ?) as "categories" from "posts"',
      );

      const selectPostsFromCategories = kysely
         .selectFrom(categories.name)
         .select((eb) => postCategoriesRel.buildWith(categories)(eb).select("id").as("posts"));
      expect(selectPostsFromCategories.compile().sql).toBe(
         'select (select "id" from "posts" inner join "posts_categories" on "posts"."id" = "posts_categories"."posts_id" where "categories"."id" = "posts_categories"."categories_id" limit ?) as "posts" from "categories"',
      );

      // mutation info
      expect(relations[0].helper(posts.name)!.getMutationInfo()).toEqual({
         reference: "categories",
         local_field: undefined,
         $set: false,
         $create: false,
         $attach: true,
         $detach: true,
         primary: "id",
         cardinality: undefined,
         relation_type: "m:n",
      });
      expect(relations[0].helper(categories.name)!.getMutationInfo()).toEqual({
         reference: "posts",
         local_field: undefined,
         $set: false,
         $create: false,
         $attach: false,
         $detach: false,
         primary: undefined,
         cardinality: undefined,
         relation_type: "m:n",
      });

      /*console.log("");
      console.log("ManyToMany (source=posts, target=categories)");
      // prettier-ignore
      console.log("posts perspective",relations[0].helper(posts.name)!.getMutationInfo());
      // prettier-ignore
      console.log("categories perspective", relations[0]!.helper(categories.name)!.getMutationInfo());
      console.log("");*/
   });
});
