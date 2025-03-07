import { unlink } from "node:fs/promises";
import type { SelectQueryBuilder, SqliteDatabase } from "kysely";
import Database from "libsql";
import { format as sqlFormat } from "sql-formatter";
import { type Connection, EntityManager, SqliteLocalConnection } from "../src/data";
import type { em as protoEm } from "../src/data/prototype";

export function getDummyDatabase(memory: boolean = true): {
   dummyDb: SqliteDatabase;
   afterAllCleanup: () => Promise<boolean>;
} {
   const DB_NAME = memory ? ":memory:" : `${Math.random().toString(36).substring(7)}.db`;
   const dummyDb = new Database(DB_NAME);

   return {
      dummyDb,
      afterAllCleanup: async () => {
         if (!memory) await unlink(DB_NAME);
         return true;
      },
   };
}

export function getDummyConnection(memory: boolean = true) {
   const { dummyDb, afterAllCleanup } = getDummyDatabase(memory);
   const dummyConnection = new SqliteLocalConnection(dummyDb);

   return {
      dummyConnection,
      afterAllCleanup,
   };
}

export function getLocalLibsqlConnection() {
   return { url: "http://127.0.0.1:8080" };
}

type ConsoleSeverity = "log" | "warn" | "error";
const _oldConsoles = {
   log: console.log,
   warn: console.warn,
   error: console.error,
};

export function disableConsoleLog(severities: ConsoleSeverity[] = ["log", "warn"]) {
   severities.forEach((severity) => {
      console[severity] = () => null;
   });
}

export function enableConsoleLog() {
   Object.entries(_oldConsoles).forEach(([severity, fn]) => {
      console[severity as ConsoleSeverity] = fn;
   });
}

export function compileQb(qb: SelectQueryBuilder<any, any, any>) {
   const { sql, parameters } = qb.compile();
   return { sql, parameters };
}

export function prettyPrintQb(qb: SelectQueryBuilder<any, any, any>) {
   const { sql, parameters } = qb.compile();
   console.log("$", sqlFormat(sql), "\n[params]", parameters);
}

export function schemaToEm(s: ReturnType<typeof protoEm>, conn?: Connection): EntityManager<any> {
   const connection = conn ? conn : getDummyConnection().dummyConnection;
   return new EntityManager(Object.values(s.entities), connection, s.relations, s.indices);
}

export const assetsPath = `${import.meta.dir}/_assets`;
export const assetsTmpPath = `${import.meta.dir}/_assets/tmp`;
