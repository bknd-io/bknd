import { nodeSqlite } from "./NodeSqliteConnection";
import { DatabaseSync } from "node:sqlite";
import { connectionTestSuite } from "data/connection/connection-test-suite";
import { describe } from "vitest";
import { viTestRunner } from "../vitest";

describe("NodeSqliteConnection", () => {
   connectionTestSuite(viTestRunner, {
      makeConnection: () => ({
         connection: nodeSqlite({ database: new DatabaseSync(":memory:") }),
         dispose: async () => {},
      }),
      rawDialectDetails: [],
   });
});
