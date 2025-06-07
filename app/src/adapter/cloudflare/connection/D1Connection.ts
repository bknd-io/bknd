/// <reference types="@cloudflare/workers-types" />

import { KyselyPluginRunner, SqliteConnection, SqliteIntrospector } from "bknd/data";
import type { QB } from "data/connection/Connection";
import { type DatabaseIntrospector, Kysely, ParseJSONResultsPlugin } from "kysely";
import { D1Dialect } from "kysely-d1";

export type D1ConnectionConfig<DB extends D1Database | D1DatabaseSession = D1Database> = {
   binding: DB;
};

class CustomD1Dialect extends D1Dialect {
   override createIntrospector(db: Kysely<any>): DatabaseIntrospector {
      return new SqliteIntrospector(db, {
         excludeTables: ["_cf_KV", "_cf_METADATA"],
      });
   }
}

export class D1Connection<
   DB extends D1Database | D1DatabaseSession = D1Database,
> extends SqliteConnection {
   protected override readonly supported = {
      batching: true,
   };

   constructor(private config: D1ConnectionConfig<DB>) {
      const plugins = [new ParseJSONResultsPlugin()];

      const kysely = new Kysely({
         dialect: new CustomD1Dialect({ database: config.binding as D1Database }),
         plugins,
      });
      super(kysely, {}, plugins);
   }

   get client(): DB {
      return this.config.binding;
   }

   protected override async batch<Queries extends QB[]>(
      queries: [...Queries],
   ): Promise<{
      [K in keyof Queries]: Awaited<ReturnType<Queries[K]["execute"]>>;
   }> {
      const db = this.config.binding;

      const res = await db.batch(
         queries.map((q) => {
            const { sql, parameters } = q.compile();
            return db.prepare(sql).bind(...parameters);
         }),
      );

      // let it run through plugins
      const kyselyPlugins = new KyselyPluginRunner(this.plugins);
      const data: any = [];
      for (const r of res) {
         const rows = await kyselyPlugins.transformResultRows(r.results);
         data.push(rows);
      }

      return data;
   }
}
