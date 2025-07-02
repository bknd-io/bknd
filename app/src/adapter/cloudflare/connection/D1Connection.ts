/// <reference types="@cloudflare/workers-types" />

import { genericSqlite, type GenericSqliteConnection } from "bknd/data";
import type { QueryResult } from "kysely";

export type D1SqliteConnection = GenericSqliteConnection<D1Database>;

export type D1ConnectionConfig<DB extends D1Database | D1DatabaseSession = D1Database> = {
   binding: DB;
};

export function d1Sqlite<DB extends D1Database | D1DatabaseSession = D1Database>(
   config: D1ConnectionConfig<DB>,
) {
   const db = config.binding;

   return genericSqlite(
      "d1-sqlite",
      db,
      (utils) => {
         const getStmt = (sql: string, parameters?: any[] | readonly any[]) =>
            db.prepare(sql).bind(...(parameters || []));

         const mapResult = (res: D1Result<any>): QueryResult<any> => {
            if (res.error) {
               throw new Error(res.error);
            }

            const numAffectedRows =
               res.meta.changes > 0 ? utils.parseBigInt(res.meta.changes) : undefined;
            const insertId = res.meta.last_row_id
               ? utils.parseBigInt(res.meta.last_row_id)
               : undefined;

            return {
               insertId,
               numAffectedRows,
               rows: res.results,
               // @ts-ignore
               meta: res.meta,
            };
         };

         return {
            db,
            batch: async (stmts) => {
               const res = await db.batch(
                  stmts.map(({ sql, parameters }) => {
                     return getStmt(sql, parameters);
                  }),
               );
               return res.map(mapResult);
            },
            query: utils.buildQueryFn({
               all: async (sql, parameters) => {
                  const prep = getStmt(sql, parameters);
                  return mapResult(await prep.all()).rows;
               },
               run: async (sql, parameters) => {
                  const prep = getStmt(sql, parameters);
                  return mapResult(await prep.run());
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
