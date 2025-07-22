// eslint-disable-next-line import/no-unresolved
import { afterAll, describe, expect, test } from "bun:test";
import { randomString } from "core/utils";
import { Entity, EntityManager } from "data/entities";
import { TextField, EntityIndex } from "data/fields";
import { SchemaManager } from "data/schema/SchemaManager";
import { getDummyConnection } from "../helper";

const { dummyConnection, afterAllCleanup } = getDummyConnection();
afterAll(afterAllCleanup);

describe("SchemaManager tests", async () => {
   test("introspect entity", async () => {
      const email = new TextField("email");
      const entity = new Entity("test", [new TextField("username"), email, new TextField("bio")]);
      const index = new EntityIndex(entity, [email]);
      const em = new EntityManager([entity], dummyConnection, [], [index]);
      const schema = new SchemaManager(em);

      const introspection = schema.getIntrospectionFromEntity(em.entities[0]!);
      expect(introspection).toEqual({
         name: "test",
         isView: false,
         columns: [
            {
               name: "id",
               dataType: "TEXT",
               isNullable: true,
               isAutoIncrementing: true,
               hasDefaultValue: false,
               comment: undefined,
            },
            {
               name: "username",
               dataType: "TEXT",
               isNullable: true,
               isAutoIncrementing: false,
               hasDefaultValue: false,
               comment: undefined,
            },
            {
               name: "email",
               dataType: "TEXT",
               isNullable: true,
               isAutoIncrementing: false,
               hasDefaultValue: false,
               comment: undefined,
            },
            {
               name: "bio",
               dataType: "TEXT",
               isNullable: true,
               isAutoIncrementing: false,
               hasDefaultValue: false,
               comment: undefined,
            },
         ],
         indices: [
            {
               name: "idx_test_email",
               table: "test",
               isUnique: false,
               columns: [
                  {
                     name: "email",
                     order: 0,
                  },
               ],
            },
         ],
      });
   });

   test("add column", async () => {
      const table = "add_column";
      const index = "idx_add_column";
      const em = new EntityManager(
         [
            new Entity(table, [
               new TextField("username"),
               new TextField("email"),
               new TextField("bio"),
            ]),
         ],
         dummyConnection,
      );
      const kysely = em.connection.kysely;

      await kysely.schema
         .createTable(table)
         .ifNotExists()
         .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement().notNull())
         .addColumn("username", "text")
         .addColumn("email", "text")
         .execute();
      await kysely.schema.createIndex(index).on(table).columns(["username"]).execute();

      const schema = new SchemaManager(em);
      const diff = await schema.getDiff();

      expect(diff).toEqual([
         {
            name: table,
            isNew: false,
            columns: { add: ["bio"], drop: [], change: [] },
            indices: { add: [], drop: [index] },
         },
      ]);

      // now sync
      await schema.sync({ force: true, drop: true });
      const diffAfter = await schema.getDiff();

      //console.log("diffAfter", diffAfter);
      expect(diffAfter.length).toBe(0);

      await kysely.schema.dropTable(table).execute();
   });

   test("drop column", async () => {
      const table = "drop_column";
      const em = new EntityManager(
         [new Entity(table, [new TextField("username")])],
         dummyConnection,
      );
      const kysely = em.connection.kysely;

      await kysely.schema
         .createTable(table)
         .ifNotExists()
         .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement().notNull())
         .addColumn("username", "text")
         .addColumn("email", "text")
         .execute();

      const schema = new SchemaManager(em);
      const diff = await schema.getDiff();

      expect(diff).toEqual([
         {
            name: table,
            isNew: false,
            columns: {
               add: [],
               drop: ["email"],
               change: [],
            },
            indices: { add: [], drop: [] },
         },
      ]);

      // now sync
      await schema.sync({ force: true, drop: true });
      const diffAfter = await schema.getDiff();

      //console.log("diffAfter", diffAfter);
      expect(diffAfter.length).toBe(0);

      await kysely.schema.dropTable(table).execute();
   });

   test("create table and add column", async () => {
      const usersTable = "create_users";
      const postsTable = "create_posts";
      const em = new EntityManager(
         [
            new Entity(usersTable, [
               new TextField("username"),
               new TextField("email"),
               new TextField("bio"),
            ]),
            new Entity(postsTable, [
               new TextField("title"),
               new TextField("content"),
               new TextField("created_at"),
            ]),
         ],
         dummyConnection,
      );
      const kysely = em.connection.kysely;

      await kysely.schema
         .createTable(usersTable)
         .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement().notNull())
         .addColumn("username", "text")
         .addColumn("email", "text")
         .execute();

      const schema = new SchemaManager(em);
      const diff = await schema.getDiff();

      expect(diff).toEqual([
         {
            name: usersTable,
            isNew: false,
            columns: { add: ["bio"], drop: [], change: [] },
            indices: { add: [], drop: [] },
         },
         {
            name: postsTable,
            isNew: true,
            columns: {
               add: ["id", "title", "content", "created_at"],
               drop: [],
               change: [],
            },
            indices: { add: [], drop: [] },
         },
      ]);

      // now sync
      await schema.sync({ force: true });
      const diffAfter = await schema.getDiff();

      //console.log("diffAfter", diffAfter);
      expect(diffAfter.length).toBe(0);

      await kysely.schema.dropTable(usersTable).execute();
      await kysely.schema.dropTable(postsTable).execute();
   });

   test("adds index on create", async () => {
      const entity = new Entity(randomString(16), [new TextField("email")]);
      const index = new EntityIndex(entity, [entity.getField("email")!]);
      const em = new EntityManager([entity], dummyConnection, [], [index]);

      const diff = await em.schema().getDiff();
      expect(diff).toEqual([
         {
            name: entity.name,
            isNew: true,
            columns: { add: ["id", "email"], drop: [], change: [] },
            indices: { add: [index.name!], drop: [] },
         },
      ]);

      // sync and then check again
      await em.schema().sync({ force: true });

      const diffAfter = await em.schema().getDiff();
      expect(diffAfter.length).toBe(0);
   });

   test("adds index after", async () => {
      const { dummyConnection } = getDummyConnection();

      const entity = new Entity(randomString(16), [new TextField("email", { required: true })]);
      const em = new EntityManager([entity], dummyConnection);
      await em.schema().sync({ force: true });

      // now add index
      const index = new EntityIndex(entity, [entity.getField("email")!], true);
      em.addIndex(index);

      const diff = await em.schema().getDiff();
      expect(diff).toEqual([
         {
            name: entity.name,
            isNew: false,
            columns: { add: [], drop: [], change: [] },
            indices: { add: [index.name!], drop: [] },
         },
      ]);

      // sync and then check again
      await em.schema().sync({ force: true });

      const diffAfter = await em.schema().getDiff();
      expect(diffAfter.length).toBe(0);
   });
});
