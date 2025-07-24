import { afterAll, describe, expect, test } from "bun:test";
import { EntityManager } from "data/entities/EntityManager";
import { getDummyConnection } from "../../helper";

const { dummyConnection, afterAllCleanup } = getDummyConnection();
afterAll(afterAllCleanup);

describe("Connection", async () => {
   test("it introspects indices correctly", async () => {
      const em = new EntityManager([], dummyConnection);
      const kysely = em.connection.kysely;

      await kysely.schema.createTable("items").ifNotExists().addColumn("name", "text").execute();
      await kysely.schema.createIndex("idx_items_name").on("items").columns(["name"]).execute();

      const indices = await em.connection.getIntrospector().getIndices("items");
      expect(indices).toEqual([
         {
            name: "idx_items_name",
            table: "items",
            isUnique: false,
            columns: [
               {
                  name: "name",
                  order: 0,
               },
            ],
         },
      ]);
   });

   test("it introspects indices on multiple columns correctly", async () => {
      const em = new EntityManager([], dummyConnection);
      const kysely = em.connection.kysely;

      await kysely.schema
         .createTable("items_multiple")
         .ifNotExists()
         .addColumn("name", "text")
         .addColumn("desc", "text")
         .execute();
      await kysely.schema
         .createIndex("idx_items_multiple")
         .on("items_multiple")
         .columns(["name", "desc"])
         .execute();

      const indices = await em.connection.getIntrospector().getIndices("items_multiple");
      expect(indices).toEqual([
         {
            name: "idx_items_multiple",
            table: "items_multiple",
            isUnique: false,
            columns: [
               {
                  name: "name",
                  order: 0,
               },
               {
                  name: "desc",
                  order: 1,
               },
            ],
         },
      ]);
   });

   test("it introspects unique indices correctly", async () => {
      const em = new EntityManager([], dummyConnection);
      const kysely = em.connection.kysely;
      const tbl_name = "items_unique";
      const idx_name = "idx_items_unique";

      await kysely.schema.createTable(tbl_name).ifNotExists().addColumn("name", "text").execute();
      await kysely.schema.createIndex(idx_name).on(tbl_name).columns(["name"]).unique().execute();

      const indices = await em.connection.getIntrospector().getIndices(tbl_name);
      expect(indices).toEqual([
         {
            name: idx_name,
            table: tbl_name,
            isUnique: true,
            columns: [
               {
                  name: "name",
                  order: 0,
               },
            ],
         },
      ]);
   });
});
