import type { DuckDBInstance } from "@duckdb/node-api";
import type { Dialect, Kysely, KyselyPlugin } from "kysely";
import { DuckdbAdapter } from "./DuckdbAdapter";
import { DuckdbDriver } from "./DuckdbDriver";
import { DuckdbIntrospector } from "./DuckdbIntrospector";
import { DuckdbQueryCompiler } from "./DuckdbQueryCompiler";

export type DuckdbDialectConfig = {
   instance?: DuckDBInstance | (() => Promise<DuckDBInstance>);
   path?: string;
   options?: Record<string, string>;
   excludeTables?: string[];
   plugins?: KyselyPlugin[];
};

export class DuckdbDialect implements Dialect {
   constructor(private readonly config: DuckdbDialectConfig = {}) {}

   createAdapter(): DuckdbAdapter {
      return new DuckdbAdapter();
   }

   createDriver(): DuckdbDriver {
      return new DuckdbDriver(this.config);
   }

   createIntrospector(db: Kysely<any>): DuckdbIntrospector {
      return new DuckdbIntrospector(db, {
         excludeTables: this.config.excludeTables,
         plugins: this.config.plugins,
      });
   }

   createQueryCompiler(): DuckdbQueryCompiler {
      return new DuckdbQueryCompiler();
   }
}
