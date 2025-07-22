import { Database } from "bun:sqlite";
import { genericSqlite, type GenericSqliteConnection } from "bknd";

export type BunSqliteConnection = GenericSqliteConnection<Database>;
export type BunSqliteConnectionConfig = {
   database: Database;
};

export function bunSqlite(config?: BunSqliteConnectionConfig | { url: string }) {
   let db: Database;
   if (config) {
      if ("database" in config) {
         db = config.database;
      } else {
         db = new Database(config.url);
      }
   } else {
      db = new Database(":memory:");
   }

   return genericSqlite("bun-sqlite", db, (utils) => {
      //const fn = cache ? "query" : "prepare";
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
   });
}
