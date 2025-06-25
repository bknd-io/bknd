import {
   SqliteAdapter,
   SqliteIntrospector,
   SqliteQueryCompiler,
   type CompiledQuery,
   type DatabaseConnection,
   type DatabaseIntrospector,
   type Dialect,
   type Driver,
   type Kysely,
   type QueryCompiler,
   type QueryResult,
} from "kysely";

/**
 * Config for the D1 dialect. Pass your D1 instance to this object that you bound in `wrangler.toml`.
 */
export interface D1DialectConfig {
   database: D1Database;
}

/**
 * D1 dialect that adds support for [Cloudflare D1][0] in [Kysely][1].
 * The constructor takes the instance of your D1 database that you bound in `wrangler.toml`.
 *
 * ```typescript
 * new D1Dialect({
 *   database: env.DB,
 * })
 * ```
 *
 * [0]: https://blog.cloudflare.com/introducing-d1/
 * [1]: https://github.com/koskimas/kysely
 */
export class D1Dialect implements Dialect {
   #config: D1DialectConfig;

   constructor(config: D1DialectConfig) {
      this.#config = config;
   }

   createAdapter() {
      return new SqliteAdapter();
   }

   createDriver(): Driver {
      return new D1Driver(this.#config);
   }

   createQueryCompiler(): QueryCompiler {
      return new SqliteQueryCompiler();
   }

   createIntrospector(db: Kysely<any>): DatabaseIntrospector {
      return new SqliteIntrospector(db);
   }
}

class D1Driver implements Driver {
   #config: D1DialectConfig;

   constructor(config: D1DialectConfig) {
      this.#config = config;
   }

   async init(): Promise<void> {}

   async acquireConnection(): Promise<DatabaseConnection> {
      return new D1Connection(this.#config);
   }

   async beginTransaction(conn: D1Connection): Promise<void> {
      return await conn.beginTransaction();
   }

   async commitTransaction(conn: D1Connection): Promise<void> {
      return await conn.commitTransaction();
   }

   async rollbackTransaction(conn: D1Connection): Promise<void> {
      return await conn.rollbackTransaction();
   }

   async releaseConnection(_conn: D1Connection): Promise<void> {}

   async destroy(): Promise<void> {}
}

class D1Connection implements DatabaseConnection {
   #config: D1DialectConfig;

   constructor(config: D1DialectConfig) {
      this.#config = config;
   }

   async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
      const results = await this.#config.database
         .prepare(compiledQuery.sql)
         .bind(...compiledQuery.parameters)
         .all();
      if (results.error) {
         throw new Error(results.error);
      }

      const numAffectedRows = results.meta.changes > 0 ? BigInt(results.meta.changes) : undefined;

      return {
         insertId:
            results.meta.last_row_id === undefined || results.meta.last_row_id === null
               ? undefined
               : BigInt(results.meta.last_row_id),
         rows: (results?.results as O[]) || [],
         numAffectedRows,
         // @ts-ignore deprecated in kysely >= 0.23, keep for backward compatibility.
         numUpdatedOrDeletedRows: numAffectedRows,
      };
   }

   async beginTransaction() {
      throw new Error("Transactions are not supported yet.");
   }

   async commitTransaction() {
      throw new Error("Transactions are not supported yet.");
   }

   async rollbackTransaction() {
      throw new Error("Transactions are not supported yet.");
   }

   // biome-ignore lint/correctness/useYield: <explanation>
   async *streamQuery<O>(
      _compiledQuery: CompiledQuery,
      _chunkSize: number,
   ): AsyncIterableIterator<QueryResult<O>> {
      throw new Error("D1 Driver does not support streaming");
   }
}
