import type { Client, Config, ResultSet } from "@libsql/client";
import { createClient } from "libsql-stateless-easy";
import { FilterNumericKeysPlugin } from "data/plugins/FilterNumericKeysPlugin";
import {
   genericSqlite,
   type GenericSqliteConnection,
} from "data/connection/sqlite/GenericSqliteConnection";
import type { QueryResult } from "kysely";

export type LibsqlConnection = GenericSqliteConnection<Client>;
export type LibSqlCredentials = Config;

function getClient(clientOrCredentials: Client | LibSqlCredentials): Client {
   if (clientOrCredentials && "url" in clientOrCredentials) {
      const { url, authToken } = clientOrCredentials;
      return createClient({ url, authToken });
   }

   return clientOrCredentials as Client;
}

export function libsql(config: LibSqlCredentials | Client) {
   const db = getClient(config);

   return genericSqlite(
      "libsql",
      db,
      (utils) => {
         const mapResult = (result: ResultSet): QueryResult<any> => ({
            insertId: result.lastInsertRowid,
            numAffectedRows: BigInt(result.rowsAffected),
            rows: result.rows,
         });
         const execute = async (sql: string, parameters?: any[] | readonly any[]) => {
            const result = await db.execute({ sql, args: [...(parameters || [])] });
            return mapResult(result);
         };

         return {
            db,
            batch: async (stmts) => {
               const results = await db.batch(
                  stmts.map(({ sql, parameters }) => ({
                     sql,
                     args: parameters as any[],
                  })),
               );
               return results.map(mapResult);
            },
            query: utils.buildQueryFn({
               all: async (sql, parameters) => {
                  return (await execute(sql, parameters)).rows;
               },
               run: execute,
            }),
            close: () => db.close(),
         };
      },
      {
         supports: {
            batching: true,
            softscans: true,
         },
         additionalPlugins: [new FilterNumericKeysPlugin()],
         excludeTables: ["libsql_wasm_func_table"],
      },
   );
}
