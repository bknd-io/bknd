import type { Client, Transaction, InValue } from "@libsql/client";
import {
   SqliteAdapter,
   SqliteIntrospector,
   SqliteQueryCompiler,
   type Kysely,
   type Dialect,
   type DialectAdapter,
   type Driver,
   type DatabaseIntrospector,
   type QueryCompiler,
   type TransactionSettings,
   type DatabaseConnection,
   type QueryResult,
   type CompiledQuery,
} from "kysely";

export type LibsqlDialectConfig = {
   client: Client;
};

export class LibsqlDialect implements Dialect {
   #config: LibsqlDialectConfig;

   constructor(config: LibsqlDialectConfig) {
      this.#config = config;
   }

   createAdapter(): DialectAdapter {
      return new SqliteAdapter();
   }

   createDriver(): Driver {
      let client: Client;
      let closeClient: boolean;
      if ("client" in this.#config) {
         client = this.#config.client;
         closeClient = false;
      } else {
         throw new Error("Please specify either `client` or `url` in the LibsqlDialect config");
      }

      return new LibsqlDriver(client, closeClient);
   }

   createIntrospector(db: Kysely<any>): DatabaseIntrospector {
      return new SqliteIntrospector(db);
   }

   createQueryCompiler(): QueryCompiler {
      return new SqliteQueryCompiler();
   }
}

export class LibsqlDriver implements Driver {
   client: Client;
   #closeClient: boolean;

   constructor(client: Client, closeClient: boolean) {
      this.client = client;
      this.#closeClient = closeClient;
   }

   async init(): Promise<void> {}

   async acquireConnection(): Promise<LibsqlConnection> {
      return new LibsqlConnection(this.client);
   }

   async beginTransaction(
      connection: LibsqlConnection,
      _settings: TransactionSettings,
   ): Promise<void> {
      await connection.beginTransaction();
   }

   async commitTransaction(connection: LibsqlConnection): Promise<void> {
      await connection.commitTransaction();
   }

   async rollbackTransaction(connection: LibsqlConnection): Promise<void> {
      await connection.rollbackTransaction();
   }

   async releaseConnection(_conn: LibsqlConnection): Promise<void> {}

   async destroy(): Promise<void> {
      if (this.#closeClient) {
         this.client.close();
      }
   }
}

export class LibsqlConnection implements DatabaseConnection {
   client: Client;
   #transaction?: Transaction;

   constructor(client: Client) {
      this.client = client;
   }

   async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
      const target = this.#transaction ?? this.client;
      const result = await target.execute({
         sql: compiledQuery.sql,
         args: compiledQuery.parameters as Array<InValue>,
      });
      return {
         insertId: result.lastInsertRowid,
         numAffectedRows: BigInt(result.rowsAffected),
         rows: result.rows as Array<R>,
      };
   }

   async beginTransaction() {
      if (this.#transaction) {
         throw new Error("Transaction already in progress");
      }
      this.#transaction = await this.client.transaction();
   }

   async commitTransaction() {
      if (!this.#transaction) {
         throw new Error("No transaction to commit");
      }
      await this.#transaction.commit();
      this.#transaction = undefined;
   }

   async rollbackTransaction() {
      if (!this.#transaction) {
         throw new Error("No transaction to rollback");
      }
      await this.#transaction.rollback();
      this.#transaction = undefined;
   }

   // biome-ignore lint/correctness/useYield: <explanation>
   async *streamQuery<R>(
      _compiledQuery: CompiledQuery,
      _chunkSize: number,
   ): AsyncIterableIterator<QueryResult<R>> {
      throw new Error("Libsql Driver does not support streaming yet");
   }
}
