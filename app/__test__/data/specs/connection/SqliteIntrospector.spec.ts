import { describe, expect, test } from "bun:test";
import { SqliteIntrospector } from "data/connection";
import { getDummyDatabase } from "../../helper";
import { Kysely, SqliteDialect } from "kysely";

function create() {
   const database = getDummyDatabase().dummyDb;
   return new Kysely({
      dialect: new SqliteDialect({ database }),
   });
}

function createLibsql() {
   const database = getDummyDatabase().dummyDb;
   return new Kysely({
      dialect: new SqliteDialect({ database }),
   });
}

describe("SqliteIntrospector", () => {
   test("asdf", async () => {
      const kysely = create();

      await kysely.schema
         .createTable("test")
         .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement().notNull())
         .addColumn("string", "text", (col) => col.notNull())
         .addColumn("number", "integer")
         .execute();

      await kysely.schema
         .createIndex("idx_test_string")
         .on("test")
         .columns(["string"])
         .unique()
         .execute();

      await kysely.schema
         .createTable("test2")
         .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement().notNull())
         .addColumn("number", "integer")
         .execute();

      await kysely.schema.createIndex("idx_test2_number").on("test2").columns(["number"]).execute();

      const introspector = new SqliteIntrospector(kysely, {});

      const result = await introspector.getTables();

      //console.log(_jsonp(result));

      expect(result).toEqual([
         {
            name: "test",
            isView: false,
            columns: [
               {
                  name: "id",
                  dataType: "INTEGER",
                  isNullable: false,
                  isAutoIncrementing: true,
                  hasDefaultValue: false,
                  comment: undefined,
               },
               {
                  name: "string",
                  dataType: "TEXT",
                  isNullable: false,
                  isAutoIncrementing: false,
                  hasDefaultValue: false,
                  comment: undefined,
               },
               {
                  comment: undefined,
                  dataType: "INTEGER",
                  hasDefaultValue: false,
                  isAutoIncrementing: false,
                  isNullable: true,
                  name: "number",
               },
            ],
         },
         {
            name: "test2",
            isView: false,
            columns: [
               {
                  name: "id",
                  dataType: "INTEGER",
                  isNullable: false,
                  isAutoIncrementing: true,
                  hasDefaultValue: false,
                  comment: undefined,
               },
               {
                  name: "number",
                  dataType: "INTEGER",
                  isNullable: true,
                  isAutoIncrementing: false,
                  hasDefaultValue: false,
                  comment: undefined,
               },
            ],
         },
      ]);
   });
});
