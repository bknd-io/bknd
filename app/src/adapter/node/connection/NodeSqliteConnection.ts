import { genericSqlite } from "data/connection/sqlite/GenericSqliteConnection";
import { DatabaseSync } from "node:sqlite";

export type NodeSqliteConnectionConfig = {
   database: DatabaseSync;
};

export function nodeSqlite(config?: NodeSqliteConnectionConfig | { url: string }) {
   let db: DatabaseSync;
   if (config) {
      if ("database" in config) {
         db = config.database;
      } else {
         db = new DatabaseSync(config.url);
      }
   } else {
      db = new DatabaseSync(":memory:");
   }

   return genericSqlite("node-sqlite", db, (utils) => {
      const getStmt = (sql: string) => {
         const stmt = db.prepare(sql);
         //stmt.setReadBigInts(true);
         return stmt;
      };

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
   });
}
