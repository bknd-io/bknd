import { nodeSqlite } from "./NodeSqliteConnection";
import { DatabaseSync } from "node:sqlite";
import { connectionTestSuite } from "data/connection/connection-test-suite";
import { describe, beforeAll, afterAll, test, expect, vi } from "vitest";
import { viTestRunner } from "../vitest";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";
import { GenericSqliteConnection } from "data/connection/sqlite/GenericSqliteConnection";

beforeAll(() => disableConsoleLog());
afterAll(() => enableConsoleLog());

describe("NodeSqliteConnection", () => {
   connectionTestSuite(viTestRunner, {
      makeConnection: () => ({
         connection: nodeSqlite({ database: new DatabaseSync(":memory:") }),
         dispose: async () => {},
      }),
      rawDialectDetails: [],
   });

   test("onCreateConnection", async () => {
      const called = vi.fn(() => null);

      const conn = nodeSqlite({
         onCreateConnection: (db) => {
            expect(db).toBeInstanceOf(DatabaseSync);
            called();
         },
      });
      await conn.ping();

      expect(conn).toBeInstanceOf(GenericSqliteConnection);
      expect(conn.db).toBeInstanceOf(DatabaseSync);
      expect(called).toHaveBeenCalledOnce();
   });
});
