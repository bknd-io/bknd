import { describe, test, expect } from "vitest";

import { viTestRunner } from "adapter/node/vitest";
import { connectionTestSuite } from "data/connection/connection-test-suite";
import { Miniflare } from "miniflare";
import { d1Sqlite } from "./D1Connection";
import { sql } from "kysely";

describe("d1Sqlite", async () => {
   const mf = new Miniflare({
      modules: true,
      script: "export default { async fetch() { return new Response(null); } }",
      d1Databases: ["DB"],
   });
   const binding = (await mf.getD1Database("DB")) as D1Database;

   test("connection", async () => {
      const conn = d1Sqlite({ binding });
      expect(conn.supports("batching")).toBe(true);
      expect(conn.supports("softscans")).toBe(false);
   });

   test("query details", async () => {
      const conn = d1Sqlite({ binding });

      const res = await conn.executeQuery(sql`select 1`.compile(conn.kysely));
      expect(res.rows).toEqual([{ "1": 1 }]);
      expect(res.numAffectedRows).toBe(undefined);
      expect(res.insertId).toBe(undefined);
      // @ts-expect-error
      expect(res.meta.changed_db).toBe(false);
      // @ts-expect-error
      expect(res.meta.rows_read).toBe(0);

      const batchResult = await conn.executeQueries(
         sql`select 1`.compile(conn.kysely),
         sql`select 2`.compile(conn.kysely),
      );

      // rewrite to get index
      for (const [index, result] of batchResult.entries()) {
         expect(result.rows).toEqual([{ [String(index + 1)]: index + 1 }]);
         expect(result.numAffectedRows).toBe(undefined);
         expect(result.insertId).toBe(undefined);
         // @ts-expect-error
         expect(result.meta.changed_db).toBe(false);
      }
   });

   connectionTestSuite(viTestRunner, {
      makeConnection: () => d1Sqlite({ binding }),
      rawDialectDetails: [],
   });
});
