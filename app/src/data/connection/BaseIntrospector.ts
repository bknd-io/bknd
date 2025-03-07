import {
   type DatabaseMetadata,
   type DatabaseMetadataOptions,
   type Kysely,
   type KyselyPlugin,
   type RawBuilder,
   type TableMetadata,
   type DatabaseIntrospector,
   type SchemaMetadata,
   ParseJSONResultsPlugin,
   DEFAULT_MIGRATION_TABLE,
   DEFAULT_MIGRATION_LOCK_TABLE,
} from "kysely";
import { KyselyPluginRunner } from "data/plugins/KyselyPluginRunner";
import type { IndexMetadata } from "data/connection/Connection";

export type TableSpec = TableMetadata & {
   indices: IndexMetadata[];
};
export type SchemaSpec = TableSpec[];

export type BaseIntrospectorConfig = {
   excludeTables?: string[];
   plugins?: KyselyPlugin[];
};

export abstract class BaseIntrospector implements DatabaseIntrospector {
   readonly _excludeTables: string[] = [];
   readonly _plugins: KyselyPlugin[];

   constructor(
      protected readonly db: Kysely<any>,
      config: BaseIntrospectorConfig = {},
   ) {
      this._excludeTables = config.excludeTables ?? [];
      this._plugins = config.plugins ?? [new ParseJSONResultsPlugin()];
   }

   abstract getSchemaSpec(): Promise<SchemaSpec>;
   abstract getSchemas(): Promise<SchemaMetadata[]>;

   protected getExcludedTableNames(): string[] {
      return [...this._excludeTables, DEFAULT_MIGRATION_TABLE, DEFAULT_MIGRATION_LOCK_TABLE];
   }

   protected async executeWithPlugins<T>(query: RawBuilder<any>): Promise<T> {
      const result = await query.execute(this.db);
      const runner = new KyselyPluginRunner(this._plugins ?? []);
      return (await runner.transformResultRows(result.rows)) as unknown as T;
   }

   async getMetadata(options?: DatabaseMetadataOptions): Promise<DatabaseMetadata> {
      return {
         tables: await this.getTables(options),
      };
   }

   async getIndices(tbl_name?: string): Promise<IndexMetadata[]> {
      const schema = await this.getSchemaSpec();
      return schema
         .flatMap((table) => table.indices)
         .filter((index) => !tbl_name || index.table === tbl_name);
   }

   async getTables(
      options: DatabaseMetadataOptions = { withInternalKyselyTables: false },
   ): Promise<TableMetadata[]> {
      const schema = await this.getSchemaSpec();
      return schema.map((table) => ({
         name: table.name,
         isView: table.isView,
         columns: table.columns,
      }));
   }
}
