/// <reference types="@cloudflare/workers-types" />

import { SqliteConnection } from "bknd/data";
import type { ConnQuery, ConnQueryResults } from "data/connection/Connection";
import { D1Dialect } from "kysely-d1";

export type D1ConnectionConfig<DB extends D1Database | D1DatabaseSession = D1Database> = {
   binding: DB;
};

export class D1Connection<
   DB extends D1Database | D1DatabaseSession = D1Database,
> extends SqliteConnection<DB> {
   override name = "sqlite-d1";

   protected override readonly supported = {
      batching: true,
      softscans: false,
   };

   constructor(private config: D1ConnectionConfig<DB>) {
      super({
         excludeTables: ["_cf_KV", "_cf_METADATA"],
         dialect: D1Dialect,
         dialectArgs: [{ database: config.binding as D1Database }],
      });
   }

   override async executeQueries<O extends ConnQuery[]>(...qbs: O): Promise<ConnQueryResults<O>> {
      const compiled = this.getCompiled(...qbs);

      const db = this.config.binding;

      const res = await db.batch(
         compiled.map(({ sql, parameters }) => {
            return db.prepare(sql).bind(...parameters);
         }),
      );

      return this.withTransformedRows(res, "results") as any;
   }
}
