import { Database } from "bun:sqlite";
import {
   genericSqlite,
   type GenericSqliteConnection,
   type GenericSqliteConnectionConfig,
} from "bknd";
import { omitKeys } from "bknd/utils";

export type BunSqliteConnection = GenericSqliteConnection<Database>;
export type BunSqliteConnectionConfig = Omit<
   GenericSqliteConnectionConfig<Database>,
   "name" | "supports"
> &
   ({ database?: Database; url?: never } | { url?: string; database?: never });

export function bunSqlite(config?: BunSqliteConnectionConfig) {
   let db: Database | undefined;
   if (config) {
      if ("database" in config && config.database) {
         db = config.database;
      } else if (config.url) {
         db = new Database(config.url);
      }
   }

   if (!db) {
      db = new Database(":memory:");
   }

   return genericSqlite(
      "bun-sqlite",
      db,
      (utils) => {
         const getStmt = (sql: string) => db.prepare(sql);

         return {
            db,
            query: utils.buildQueryFn({
               all: (sql, parameters) => getStmt(sql).all(...(parameters || [])),
               run: (sql, parameters) => {
                  const { changes, lastInsertRowid } = getStmt(sql).run(...(parameters || []));
                  return {
                     insertId: utils.parseBigInt(lastInsertRowid),
                     numAffectedRows: utils.parseBigInt(changes),
                  };
               },
            }),
            close: () => db.close(),
         };
      },
      omitKeys(config ?? ({} as any), ["database", "url", "name", "supports"]),
   );
}
