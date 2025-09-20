import {
   genericSqlite,
   type GenericSqliteConnection,
   type GenericSqliteConnectionConfig,
} from "bknd";
import { DatabaseSync } from "node:sqlite";
import { omitKeys } from "bknd/utils";

export type NodeSqliteConnection = GenericSqliteConnection<DatabaseSync>;
export type NodeSqliteConnectionConfig = Omit<
   GenericSqliteConnectionConfig<DatabaseSync>,
   "name" | "supports"
> &
   ({ database?: DatabaseSync; url?: never } | { url?: string; database?: never });

export function nodeSqlite(config?: NodeSqliteConnectionConfig) {
   let db: DatabaseSync | undefined;
   if (config) {
      if ("database" in config && config.database) {
         db = config.database;
      } else if (config.url) {
         db = new DatabaseSync(config.url);
      }
   }

   if (!db) {
      db = new DatabaseSync(":memory:");
   }

   return genericSqlite(
      "node-sqlite",
      db,
      (utils) => {
         const getStmt = (sql: string) => db.prepare(sql);

         return {
            db,
            query: utils.buildQueryFn({
               all: (sql, parameters = []) => getStmt(sql).all(...parameters),
               run: (sql, parameters = []) => {
                  const { changes, lastInsertRowid } = getStmt(sql).run(...parameters);
                  return {
                     insertId: utils.parseBigInt(lastInsertRowid),
                     numAffectedRows: utils.parseBigInt(changes),
                  };
               },
            }),
            close: () => db.close(),
            iterator: (isSelect, sql, parameters = []) => {
               if (!isSelect) {
                  throw new Error("Only support select in stream()");
               }
               return getStmt(sql).iterate(...parameters) as any;
            },
         };
      },
      {
         ...omitKeys(config ?? ({} as any), ["database", "url", "name", "supports"]),
         supports: {
            batching: false,
         },
      },
   );
}
