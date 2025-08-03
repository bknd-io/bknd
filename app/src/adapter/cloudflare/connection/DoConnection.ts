/// <reference types="@cloudflare/workers-types" />

import { genericSqlite, type GenericSqliteConnection } from "bknd";
import type { QueryResult } from "kysely";

export type D1SqliteConnection = GenericSqliteConnection<D1Database>;
export type DurableObjecSql = DurableObjectState["storage"]["sql"];

export type D1ConnectionConfig<DB extends DurableObjecSql> =
   | DurableObjectState
   | {
        sql: DB;
     };

export function doSqlite<DB extends DurableObjecSql>(config: D1ConnectionConfig<DB>) {
   const db = "sql" in config ? config.sql : config.storage.sql;

   return genericSqlite(
      "do-sqlite",
      db,
      (utils) => {
         // must be async to work with the miniflare mock
         const getStmt = async (sql: string, parameters?: any[] | readonly any[]) =>
            await db.exec(sql, ...(parameters || []));

         const mapResult = (
            cursor: SqlStorageCursor<Record<string, SqlStorageValue>>,
         ): QueryResult<any> => {
            const numAffectedRows =
               cursor.rowsWritten > 0 ? utils.parseBigInt(cursor.rowsWritten) : undefined;
            const insertId = undefined;

            const obj = {
               insertId,
               numAffectedRows,
               rows: cursor.toArray() || [],
               // @ts-ignore
               meta: {
                  rowsWritten: cursor.rowsWritten,
                  rowsRead: cursor.rowsRead,
                  databaseSize: db.databaseSize,
               },
            };
            //console.info("mapResult", obj);
            return obj;
         };

         return {
            db,
            batch: async (stmts) => {
               // @todo: maybe wrap in a transaction?
               // because d1 implicitly does a transaction on batch
               return Promise.all(
                  stmts.map(async (stmt) => {
                     return mapResult(await getStmt(stmt.sql, stmt.parameters));
                  }),
               );
            },
            query: utils.buildQueryFn({
               all: async (sql, parameters) => {
                  const prep = getStmt(sql, parameters);
                  return mapResult(await prep).rows;
               },
               run: async (sql, parameters) => {
                  const prep = getStmt(sql, parameters);
                  return mapResult(await prep);
               },
            }),
            close: () => {},
         };
      },
      {
         supports: {
            batching: true,
            softscans: false,
         },
         excludeTables: ["_cf_KV", "_cf_METADATA"],
      },
   );
}
