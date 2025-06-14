import type { TestRunner } from "core/test";
import { Connection, type FieldSpec } from "./Connection";

// @todo: add various datatypes: string, number, boolean, object, array, null, undefined, date, etc.
// @todo: add toDriver/fromDriver tests on all types and fields

export function connectionTestSuite(
   testRunner: TestRunner,
   {
      makeConnection,
      rawDialectDetails,
   }: {
      makeConnection: () => Connection;
      rawDialectDetails: string[];
   },
) {
   const { test, expect, describe } = testRunner;

   test("pings", async () => {
      const connection = makeConnection();
      const res = await connection.ping();
      expect(res).toBe(true);
   });

   test("initializes", async () => {
      const connection = makeConnection();
      await connection.init();
      // @ts-expect-error
      expect(connection.initialized).toBe(true);
      expect(connection.client).toBeDefined();
   });

   test("isConnection", async () => {
      const connection = makeConnection();
      expect(Connection.isConnection(connection)).toBe(true);
   });

   test("getFieldSchema", async () => {
      const c = makeConnection();
      const specToNode = (spec: FieldSpec) => {
         // @ts-expect-error
         const schema = c.kysely.schema.createTable("test").addColumn(...c.getFieldSchema(spec));
         return schema.toOperationNode();
      };

      {
         // primary
         const node = specToNode({
            type: "integer",
            name: "id",
            primary: true,
         });
         const col = node.columns[0]!;
         expect(col.primaryKey).toBe(true);
         expect(col.notNull).toBe(true);
      }

      {
         // normal
         const node = specToNode({
            type: "text",
            name: "text",
         });
         const col = node.columns[0]!;
         expect(!col.primaryKey).toBe(true);
         expect(!col.notNull).toBe(true);
      }

      {
         // nullable (expect to be same as normal)
         const node = specToNode({
            type: "text",
            name: "text",
            nullable: true,
         });
         const col = node.columns[0]!;
         expect(!col.primaryKey).toBe(true);
         expect(!col.notNull).toBe(true);
      }
   });

   describe("schema", async () => {
      const connection = makeConnection();
      const fields = [
         {
            type: "integer",
            name: "id",
            primary: true,
         },
         {
            type: "text",
            name: "text",
         },
         {
            type: "json",
            name: "json",
         },
      ] as const satisfies FieldSpec[];

      let b = connection.kysely.schema.createTable("test");
      for (const field of fields) {
         // @ts-expect-error
         b = b.addColumn(...connection.getFieldSchema(field));
      }
      await b.execute();

      // add index
      await connection.kysely.schema.createIndex("test_index").on("test").columns(["id"]).execute();

      test("executes query", async () => {
         await connection.kysely
            .insertInto("test")
            .values({ id: 1, text: "test", json: JSON.stringify({ a: 1 }) })
            .execute();

         const expected = { id: 1, text: "test", json: { a: 1 } };

         const qb = connection.kysely.selectFrom("test").selectAll();
         const res = await connection.executeQuery(qb);
         expect(res.rows).toEqual([expected]);
         expect(rawDialectDetails.every((detail) => detail in res)).toBe(true);

         {
            const res = await connection.executeQueries(qb, qb);
            expect(res.length).toBe(2);
            res.map((r) => {
               expect(r.rows).toEqual([expected]);
               expect(rawDialectDetails.every((detail) => detail in r)).toBe(true);
            });
         }
      });

      test("introspects", async () => {
         const tables = await connection.getIntrospector().getTables({
            withInternalKyselyTables: false,
         });
         const clean = tables.map((t) => ({
            ...t,
            columns: t.columns.map((c) => ({
               ...c,
               dataType: undefined,
            })),
         }));

         expect(clean).toEqual([
            {
               name: "test",
               isView: false,
               columns: [
                  {
                     name: "id",
                     dataType: undefined,
                     isNullable: false,
                     isAutoIncrementing: true,
                     hasDefaultValue: false,
                  },
                  {
                     name: "text",
                     dataType: undefined,
                     isNullable: true,
                     isAutoIncrementing: false,
                     hasDefaultValue: false,
                  },
                  {
                     name: "json",
                     dataType: undefined,
                     isNullable: true,
                     isAutoIncrementing: false,
                     hasDefaultValue: false,
                  },
               ],
            },
         ]);
      });

      expect(await connection.getIntrospector().getIndices()).toEqual([
         {
            name: "test_index",
            table: "test",
            isUnique: false,
            columns: [
               {
                  name: "id",
                  order: 0,
               },
            ],
         },
      ]);
   });
}
