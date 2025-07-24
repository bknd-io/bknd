import { describe, test, expect } from "vitest";

import { viTestRunner } from "adapter/node/vitest";
import { connectionTestSuite } from "data/connection/connection-test-suite";
import { Miniflare } from "miniflare";
import { d1Sqlite } from "./D1Connection";

describe("d1Sqlite", async () => {
   connectionTestSuite(viTestRunner, {
      makeConnection: async () => {
         const mf = new Miniflare({
            modules: true,
            script: "export default { async fetch() { return new Response(null); } }",
            d1Databases: ["DB"],
         });

         const binding = (await mf.getD1Database("DB")) as D1Database;
         return {
            connection: d1Sqlite({ binding }),
            dispose: () => mf.dispose(),
         };
      },
      rawDialectDetails: [
         "meta.served_by",
         "meta.duration",
         "meta.changes",
         "meta.changed_db",
         "meta.size_after",
         "meta.rows_read",
         "meta.rows_written",
      ],
   });
});
