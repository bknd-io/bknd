import { connectionTestSuite } from "data/connection/connection-test-suite";
import { bunSqlite } from "./BunSqliteConnection";
import { bunTestRunner } from "adapter/bun/test";
import { describe } from "bun:test";
import { Database } from "bun:sqlite";

describe("BunSqliteConnection", () => {
   connectionTestSuite(bunTestRunner, {
      makeConnection: () => bunSqlite({ database: new Database(":memory:") }),
      rawDialectDetails: [],
   });
});
