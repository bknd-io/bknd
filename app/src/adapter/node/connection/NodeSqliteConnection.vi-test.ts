import { nodeSqlite } from "./NodeSqliteConnection";
import { DatabaseSync } from "node:sqlite";
import { connectionTestSuite } from "data/connection/connection-test-suite";
import { describe, test, expect } from "vitest";

describe("NodeSqliteConnection", () => {
   connectionTestSuite({ describe, test, expect } as any, {
      makeConnection: () => nodeSqlite({ database: new DatabaseSync(":memory:") }),
      rawDialectDetails: [],
   });
});
