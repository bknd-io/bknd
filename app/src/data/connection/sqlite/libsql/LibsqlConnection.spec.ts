import { connectionTestSuite } from "../../connection-test-suite";
import { LibsqlConnection } from "./LibsqlConnection";
import { bunTestRunner } from "adapter/bun/test";
import { describe } from "bun:test";
import { createClient } from "@libsql/client";

describe("LibsqlConnection", () => {
   connectionTestSuite(bunTestRunner, {
      makeConnection: () => new LibsqlConnection(createClient({ url: ":memory:" })),
      rawDialectDetails: ["rowsAffected", "lastInsertRowid"],
   });
});
