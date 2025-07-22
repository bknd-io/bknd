import { unlink } from "node:fs/promises";
import type { SelectQueryBuilder, SqliteDatabase } from "kysely";
import Database from "libsql";
import { format as sqlFormat } from "sql-formatter";
import type { em as protoEm } from "../src/data/prototype";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { slugify } from "core/utils/strings";
import { type Connection, SqliteLocalConnection } from "data/connection";
import { EntityManager } from "data/entities/EntityManager";

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

type ConsoleSeverity = "debug" | "log" | "warn" | "error";
const _oldConsoles = {
   debug: console.debug,
   log: console.log,
   warn: console.warn,
   error: console.error,
};

export function disableConsoleLog(severities: ConsoleSeverity[] = ["debug", "log", "warn"]) {
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

export async function enableFetchLogging() {
   const originalFetch = global.fetch;

   // @ts-ignore
   global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await originalFetch(input, init);
      const url = input instanceof URL || typeof input === "string" ? input : input.url;

      // Only clone if it's a supported content type
      const contentType = response.headers.get("content-type") || "";
      const isSupported =
         contentType.includes("json") ||
         contentType.includes("text") ||
         contentType.includes("xml");

      if (isSupported) {
         const clonedResponse = response.clone();
         let extension = "txt";
         let body: string;

         if (contentType.includes("json")) {
            body = JSON.stringify(await clonedResponse.json(), null, 2);
            extension = "json";
         } else if (contentType.includes("xml")) {
            body = await clonedResponse.text();
            extension = "xml";
         } else {
            body = await clonedResponse.text();
         }

         const fileName = `${new Date().getTime()}_${init?.method ?? "GET"}_${slugify(String(url))}.${extension}`;
         const filePath = join(assetsTmpPath, fileName);

         await writeFile(filePath, body);
      }

      return response;
   };

   return () => {
      global.fetch = originalFetch;
   };
}
