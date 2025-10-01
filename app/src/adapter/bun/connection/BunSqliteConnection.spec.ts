import { connectionTestSuite } from "data/connection/connection-test-suite";
import { bunSqlite } from "./BunSqliteConnection";
import { bunTestRunner } from "adapter/bun/test";
import { describe, test, mock, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { GenericSqliteConnection } from "data/connection/sqlite/GenericSqliteConnection";

describe("BunSqliteConnection", () => {
   connectionTestSuite(bunTestRunner, {
      makeConnection: () => ({
         connection: bunSqlite({ database: new Database(":memory:") }),
         dispose: async () => {},
      }),
      rawDialectDetails: [],
   });

   test("onCreateConnection", async () => {
      const called = mock(() => null);

      const conn = bunSqlite({
         onCreateConnection: (db) => {
            expect(db).toBeInstanceOf(Database);
            called();
         },
      });
      await conn.ping();

      expect(conn).toBeInstanceOf(GenericSqliteConnection);
      expect(conn.db).toBeInstanceOf(Database);
      expect(called).toHaveBeenCalledTimes(1);
   });
});
