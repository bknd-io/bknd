import { connectionTestSuite } from "data/connection/connection-test-suite";
import { duckdb } from "./DuckdbConnection";
import { describe, beforeAll, afterAll } from "vitest";
import { viTestRunner } from "adapter/node/vitest";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";

beforeAll(() => disableConsoleLog());
afterAll(() => enableConsoleLog());

describe("DuckdbConnection", () => {
   connectionTestSuite(viTestRunner, {
      makeConnection: async () => {
         const connection = await duckdb();
         return {
            connection,
            dispose: () => connection.close(),
         };
      },
      rawDialectDetails: [],
   });
});
