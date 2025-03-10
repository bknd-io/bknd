import { type Client, type Config, type InStatement, createClient } from "@libsql/client";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { type DatabaseIntrospector, Kysely, ParseJSONResultsPlugin } from "kysely";
import { FilterNumericKeysPlugin } from "data/plugins/FilterNumericKeysPlugin";
import { KyselyPluginRunner } from "data/plugins/KyselyPluginRunner";
import type { QB } from "../Connection";
import { SqliteConnection } from "./SqliteConnection";
import { SqliteIntrospector } from "./SqliteIntrospector";

export const LIBSQL_PROTOCOLS = ["wss", "https", "libsql"] as const;
export type LibSqlCredentials = Config & {
   protocol?: (typeof LIBSQL_PROTOCOLS)[number];
};

const plugins = [new FilterNumericKeysPlugin(), new ParseJSONResultsPlugin()];

class CustomLibsqlDialect extends LibsqlDialect {
   override createIntrospector(db: Kysely<any>): DatabaseIntrospector {
      return new SqliteIntrospector(db, {
         excludeTables: ["libsql_wasm_func_table"],
         plugins,
      });
   }
}

export class LibsqlConnection extends SqliteConnection {
   private client: Client;

   constructor(client: Client);
   constructor(credentials: LibSqlCredentials);
   constructor(clientOrCredentials: Client | LibSqlCredentials) {
      let client: Client;
      if (clientOrCredentials && "url" in clientOrCredentials) {
         let { url, authToken, protocol } = clientOrCredentials;
         if (protocol && LIBSQL_PROTOCOLS.includes(protocol)) {
            console.log("changing protocol to", protocol);
            const [, rest] = url.split("://");
            url = `${protocol}://${rest}`;
         }

         client = createClient({ url, authToken });
      } else {
         client = clientOrCredentials;
      }

      const kysely = new Kysely({
         // @ts-expect-error libsql has type issues
         dialect: new CustomLibsqlDialect({ client }),
         plugins,
      });

      super(kysely, {}, plugins);
      this.client = client;
   }

   override supportsBatching(): boolean {
      return true;
   }

   override supportsIndices(): boolean {
      return true;
   }

   getClient(): Client {
      return this.client;
   }

   protected override async batch<Queries extends QB[]>(
      queries: [...Queries],
   ): Promise<{
      [K in keyof Queries]: Awaited<ReturnType<Queries[K]["execute"]>>;
   }> {
      const stms: InStatement[] = queries.map((q) => {
         const compiled = q.compile();
         return {
            sql: compiled.sql,
            args: compiled.parameters as any[],
         };
      });

      const res = await this.client.batch(stms);

      // let it run through plugins
      const kyselyPlugins = new KyselyPluginRunner(this.plugins);

      const data: any = [];
      for (const r of res) {
         const rows = await kyselyPlugins.transformResultRows(r.rows);
         data.push(rows);
      }

      return data;
   }
}
