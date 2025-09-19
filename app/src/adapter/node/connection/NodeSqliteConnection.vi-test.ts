import { nodeSqlite } from "./NodeSqliteConnection";
import { DatabaseSync } from "node:sqlite";
import { connectionTestSuite } from "data/connection/connection-test-suite";
import { describe, beforeAll, afterAll } from "vitest";
import { viTestRunner } from "../vitest";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";

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
});
