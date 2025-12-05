import { describe } from "bun:test";
import { SQLocalConnection } from "./SQLocalConnection";
import { connectionTestSuite } from "data/connection/connection-test-suite";
import { bunTestRunner } from "adapter/bun/test";
import { SQLocalKysely } from "sqlocal/kysely";

describe("SQLocalConnection", () => {
   connectionTestSuite(bunTestRunner, {
      makeConnection: () => ({
         connection: new SQLocalConnection(new SQLocalKysely({ databasePath: ":memory:" })),
         dispose: async () => {},
      }),
      rawDialectDetails: [],
   });
});
