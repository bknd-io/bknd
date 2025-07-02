import { connectionTestSuite } from "../../connection-test-suite";
import { libsql } from "./LibsqlConnection";
import { bunTestRunner } from "adapter/bun/test";
import { describe } from "bun:test";
import { createClient } from "@libsql/client";

describe("LibsqlConnection", () => {
   connectionTestSuite(bunTestRunner, {
      makeConnection: () => ({
         connection: libsql(createClient({ url: ":memory:" })),
         dispose: async () => {},
      }),
      rawDialectDetails: [],
   });
});
