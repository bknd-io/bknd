import type { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";
import {
   CompiledQuery,
   type DatabaseConnection,
   type Driver,
   type QueryResult,
   type TransactionSettings,
} from "kysely";
import { convertRow, toDuckdbParam } from "./utils";

export type DuckdbDriverConfig = {
   /**
    * A DuckDB instance, or a (memoized) factory for one. When omitted, an
    * instance is created from `path`/`options` on first use.
    */
   instance?: DuckDBInstance | (() => Promise<DuckDBInstance>);
   path?: string;
   options?: Record<string, string>;
};

const SELECTISH = /^(select|with|show|describe|pragma|explain|from)\b/i;

type ExecuteFn<T> = () => Promise<T>;

export class DuckdbDatabaseConnection implements DatabaseConnection {
   constructor(
      private readonly connection: DuckDBConnection,
      private readonly schedule: <T>(fn: ExecuteFn<T>) => Promise<T>,
   ) {}

   async runNative(sql: string): Promise<void> {
      await this.connection.run(sql);
   }

   async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
      return await this.schedule(async () => {
         const parameters = compiledQuery.parameters.map(toDuckdbParam);
         const result = await this.connection.run(
            compiledQuery.sql,
            parameters.length > 0 ? (parameters as never) : undefined,
         );

         const rows =
            result.columnCount > 0
               ? ((await result.getRowObjectsJS()) as Record<string, unknown>[]).map(convertRow)
               : [];

         const numAffectedRows =
            !SELECTISH.test(compiledQuery.sql) && result.rowsChanged > 0
               ? BigInt(result.rowsChanged)
               : undefined;
         return {
            rows: rows as R[],
            ...(numAffectedRows !== undefined ? { numAffectedRows } : {}),
         };
      });
   }

   async *streamQuery<R>(compiledQuery: CompiledQuery): AsyncIterableIterator<QueryResult<R>> {
      yield await this.executeQuery(compiledQuery);
   }
}

/**
 * DuckDB is an embedded single-writer engine, so like the sqlite connections
 * this driver serves all queries through ONE native connection with
 * serialized execution:
 *
 * - non-transaction queries run in submission order (schema sync fires
 *   parallel `create table` / `create index` batches that depend on order)
 * - while a transaction is open it owns the connection exclusively; other
 *   queries wait until commit/rollback
 */
export class DuckdbDriver implements Driver {
   private instance?: Promise<DuckDBInstance>;
   private native?: DuckDBConnection;
   private dbConn?: DuckdbDatabaseConnection;

   private queueTail: Promise<unknown> = Promise.resolve();
   private trxConn?: DuckdbDatabaseConnection;
   private trxDone: Promise<void> = Promise.resolve();
   private trxRelease?: () => void;

   constructor(private readonly config: DuckdbDriverConfig = {}) {}

   private async getInstance(): Promise<DuckDBInstance> {
      this.instance ??=
         typeof this.config.instance === "function"
            ? this.config.instance()
            : this.config.instance
              ? Promise.resolve(this.config.instance)
              : import("@duckdb/node-api").then(({ DuckDBInstance }) =>
                   DuckDBInstance.fromCache(this.config.path ?? ":memory:", this.config.options),
                );
      return await this.instance;
   }

   private enqueue<T>(fn: ExecuteFn<T>): Promise<T> {
      const run = this.queueTail.then(fn, fn);
      this.queueTail = run.then(
         () => {},
         () => {},
      );
      return run;
   }

   private async schedule<T>(conn: DuckdbDatabaseConnection, fn: ExecuteFn<T>): Promise<T> {
      if (this.trxConn === conn) {
         return fn();
      }
      while (this.trxConn) {
         await this.trxDone;
      }
      return this.enqueue(fn);
   }

   async init(): Promise<void> {}

   async acquireConnection(): Promise<DuckdbDatabaseConnection> {
      if (!this.dbConn) {
         const instance = await this.getInstance();
         this.native = await instance.connect();
         this.dbConn = new DuckdbDatabaseConnection(this.native, (fn) =>
            this.schedule(this.dbConn!, fn),
         );
      }
      return this.dbConn;
   }

   async releaseConnection(_connection: DuckdbDatabaseConnection): Promise<void> {}

   async beginTransaction(
      connection: DuckdbDatabaseConnection,
      _settings: TransactionSettings,
   ): Promise<void> {
      if (this.trxConn) {
         throw new Error("a transaction is already in progress on this connection");
      }
      await this.queueTail;
      this.trxConn = connection;
      this.trxDone = new Promise((resolve) => {
         this.trxRelease = resolve;
      });
      await connection.runNative("BEGIN TRANSACTION");
   }

   async commitTransaction(connection: DuckdbDatabaseConnection): Promise<void> {
      await connection.runNative("COMMIT");
      this.endTransaction();
   }

   async rollbackTransaction(connection: DuckdbDatabaseConnection): Promise<void> {
      await connection.runNative("ROLLBACK");
      this.endTransaction();
   }

   private endTransaction(): void {
      this.trxConn = undefined;
      this.trxRelease?.();
      this.trxRelease = undefined;
   }

   async savepoint(connection: DuckdbDatabaseConnection, savepointName: string): Promise<void> {
      await connection.runNative(`SAVEPOINT ${savepointName}`);
   }

   async rollbackToSavepoint(
      connection: DuckdbDatabaseConnection,
      savepointName: string,
   ): Promise<void> {
      await connection.runNative(`ROLLBACK TO SAVEPOINT ${savepointName}`);
   }

   async releaseSavepoint(
      connection: DuckdbDatabaseConnection,
      savepointName: string,
   ): Promise<void> {
      await connection.runNative(`RELEASE SAVEPOINT ${savepointName}`);
   }

   async destroy(): Promise<void> {
      // instance lifetime is owned by the connection factory, not the driver
   }
}
