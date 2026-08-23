import { connectionTestSuite } from "../connection-test-suite";
import { duckdb } from "./DuckdbConnection";
import { bunTestRunner } from "adapter/bun/test";
import { describe } from "bun:test";

describe("DuckdbConnection", () => {
   connectionTestSuite(bunTestRunner, {
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
