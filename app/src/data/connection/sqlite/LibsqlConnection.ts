import type { Client, Config, InStatement } from "@libsql/client";
import { createClient } from "libsql-stateless-easy";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { FilterNumericKeysPlugin } from "data/plugins/FilterNumericKeysPlugin";
import { type ConnQuery, type ConnQueryResults, SqliteConnection } from "bknd/data";

export const LIBSQL_PROTOCOLS = ["wss", "https", "libsql"] as const;
export type LibSqlCredentials = Config & {
   protocol?: (typeof LIBSQL_PROTOCOLS)[number];
};

function getClient(clientOrCredentials: Client | LibSqlCredentials): Client {
   if (clientOrCredentials && "url" in clientOrCredentials) {
      let { url, authToken, protocol } = clientOrCredentials;
      if (protocol && LIBSQL_PROTOCOLS.includes(protocol)) {
         console.info("changing protocol to", protocol);
         const [, rest] = url.split("://");
         url = `${protocol}://${rest}`;
      }

      return createClient({ url, authToken });
   }

   return clientOrCredentials as Client;
}

export class LibsqlConnection extends SqliteConnection<Client> {
   override name = "libsql";
   protected override readonly supported = {
      batching: true,
      softscans: true,
   };

   constructor(clientOrCredentials: Client | LibSqlCredentials) {
      const client = getClient(clientOrCredentials);

      super({
         excludeTables: ["libsql_wasm_func_table"],
         dialect: LibsqlDialect,
         dialectArgs: [{ client }],
         additionalPlugins: [new FilterNumericKeysPlugin()],
      });

      this.client = client;
   }

   override async executeQueries<O extends ConnQuery[]>(...qbs: O): Promise<ConnQueryResults<O>> {
      const compiled = this.getCompiled(...qbs);
      const stms: InStatement[] = compiled.map((q) => {
         return {
            sql: q.sql,
            args: q.parameters as any[],
         };
      });

      return this.withTransformedRows(await this.client.batch(stms)) as any;
   }
}

export function libsql(credentials: Client | LibSqlCredentials): LibsqlConnection {
   return new LibsqlConnection(credentials);
}
