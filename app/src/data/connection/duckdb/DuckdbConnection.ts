import {
   DuckDBInstance,
   type DuckDBConnection,
   type DuckDBInstance as TInstance,
} from "@duckdb/node-api";
import { Connection, type FieldSpec, type SchemaResponse } from "../Connection";
import type { Field } from "data/fields/Field";
import {
   type ColumnDefinitionBuilder,
   type ColumnDataType,
   Kysely,
   ParseJSONResultsPlugin,
   type KyselyPlugin,
} from "kysely";
import { jsonArrayFrom, jsonBuildObject, jsonObjectFrom } from "kysely/helpers/sqlite";
import { DuckdbDialect } from "./DuckdbDialect";
import { isSafeBigint } from "./utils";

export type DuckdbConfig = {
   /** Database file path, or `:memory:` (default) for an in-memory database. */
   path?: string;
   /** DuckDB configuration options, passed to the instance (e.g. `{ threads: "1" }`). */
   options?: Record<string, string>;
   /** Bring your own DuckDB instance (its lifetime is then managed by you). */
   instance?: TInstance;
   /**
    * Emit `REFERENCES` clauses for relation fields (default: false). DuckDB
    * enforces foreign keys strictly but only supports `NO ACTION`, and treats
    * row updates as delete+insert — so updating a parent row referenced by a
    * child fails. SQLite (bknd's default) does not enforce foreign keys, so
    * leaving them off matches the platform's effective behavior.
    */
   foreignKeys?: boolean;
   excludeTables?: string[];
   additionalPlugins?: KyselyPlugin[];
};

/**
 * A bknd `Connection` backed by DuckDB. DuckDB has native `BOOLEAN` and `JSON`
 * types (no SQLite-style 0/1 coercion), and integer primary keys use
 * sequence-backed defaults instead of `AUTOINCREMENT` (DuckDB's identity
 * columns are not implemented alongside constraints).
 */
export class DuckdbConnection extends Connection<DuckDBConnection> {
   override name = "duckdb";

   readonly #foreignKeys: boolean;
   readonly #instance: Promise<DuckDBInstance>;
   readonly #ownsInstance: boolean;

   constructor(config: DuckdbConfig = {}) {
      const plugins = [new ParseJSONResultsPlugin(), ...(config.additionalPlugins ?? [])];

      // in-memory databases must NOT go through the path cache: every
      // connection would otherwise share one catalog for the whole process.
      // File paths are cached so multiple connections dedupe.
      const instance = config.instance
         ? Promise.resolve(config.instance)
         : config.path && config.path !== ":memory:"
           ? DuckDBInstance.fromCache(config.path, config.options)
           : DuckDBInstance.create(config.path ?? ":memory:", config.options);

      const kysely = new Kysely({
         dialect: new DuckdbDialect({
            instance: () => instance,
            excludeTables: config.excludeTables,
            plugins,
         }),
         plugins,
      });

      super(kysely, { jsonArrayFrom, jsonObjectFrom, jsonBuildObject }, plugins);

      this.#foreignKeys = config.foreignKeys ?? false;
      this.#instance = instance;
      this.#ownsInstance = !config.instance;
   }

   override async init(): Promise<void> {
      const instance = await this.#instance;
      this.client = await instance.connect();
      this.initialized = true;
   }

   override getFieldSchema(spec: FieldSpec): SchemaResponse {
      this.validateFieldSpecType(spec.type);

      // integers are uniformly BIGINT: primary keys and their referencing
      // foreign keys must match exactly for DuckDB's FK checks
      let type: ColumnDataType = spec.type;
      switch (spec.type) {
         case "text":
            type = "varchar";
            break;
         case "real":
            type = "double precision";
            break;
         case "datetime":
         case "timestamp":
            type = "timestamp";
            break;
         // integer, blob, date, boolean, json map to DuckDB type names
         // (integer -> bigint is handled below)
      }
      if (spec.type === "integer") {
         type = "bigint";
      }

      return [
         spec.name,
         type,
         (col: ColumnDefinitionBuilder) => {
            if (spec.primary) {
               if (spec.type === "integer") {
                  return col.primaryKey().notNull().autoIncrement();
               }
               return col.primaryKey().notNull();
            }
            if (spec.references && this.#foreignKeys) {
               // DuckDB FKs support NO ACTION only — CASCADE/SET NULL/SET
               // DEFAULT are parser errors, so referential actions are never
               // emitted (and FKs are opt-in, see DuckdbConfig#foreignKeys)
               return col.references(spec.references);
            }
            return col;
         },
      ] as const;
   }

   override toDriver(value: unknown, _field: Field): unknown {
      if (value === undefined) {
         return null;
      }
      return value;
   }

   override fromDriver(value: any, _field: Field): unknown {
      if (typeof value === "bigint" && isSafeBigint(value)) {
         return Number(value);
      }
      return value;
   }

   override async close(): Promise<void> {
      await this.kysely.destroy();
      this.client?.disconnectSync();
      if (this.#ownsInstance) {
         (await this.#instance).closeSync();
      }
   }
}

/** Create a bknd connection backed by DuckDB. */
export async function duckdb(config: DuckdbConfig = {}): Promise<DuckdbConnection> {
   const connection = new DuckdbConnection(config);
   await connection.init();
   return connection;
}
