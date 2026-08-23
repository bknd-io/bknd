import { BaseIntrospector } from "../BaseIntrospector";
import type { IndexMetadata } from "../Connection";
import { sql, type Kysely, type KyselyPlugin, type TableMetadata } from "kysely";
import { parseIndexColumns } from "./utils";

export type TableSpec = TableMetadata & {
   indices: IndexMetadata[];
};

type InformationSchemaTable = {
   table_name: string;
   table_type: string;
};

type InformationSchemaColumn = {
   column_name: string;
   data_type: string;
   is_nullable: string;
   column_default: string | null;
   is_identity: string | null;
};

type DuckdbIndex = {
   index_name: string;
   table_name: string;
   is_unique: boolean;
   expressions: string;
};

function isNextvalDefault(columnDefault: string | null): boolean {
   return columnDefault !== null && columnDefault.toLowerCase().startsWith("nextval(");
}

export class DuckdbIntrospector extends BaseIntrospector {
   constructor(
      db: Kysely<any>,
      config: { excludeTables?: string[]; plugins?: KyselyPlugin[] } = {},
   ) {
      super(db, config);
   }

   override async getSchemas(): Promise<{ name: string }[]> {
      return [{ name: "main" }];
   }

   override async getSchemaSpec(): Promise<TableSpec[]> {
      const excluded = new Set(this.getExcludedTableNames());

      const tables = await this.executeWithPlugins<InformationSchemaTable[]>(sql`
         select table_name, table_type
         from information_schema.tables
         where table_schema = 'main' and table_type = 'BASE TABLE'
      `);

      const indices = await this.getIndicesInternal();

      const specs: TableSpec[] = [];
      for (const table of tables) {
         if (excluded.has(table.table_name)) {
            continue;
         }

         const columns = await this.executeWithPlugins<InformationSchemaColumn[]>(sql`
            select column_name, data_type, is_nullable, column_default, is_identity
            from information_schema.columns
            where table_schema = 'main' and table_name = ${table.table_name}
            order by ordinal_position
         `);

         specs.push({
            name: table.table_name,
            isView: false,
            columns: columns.map((column) => ({
               name: column.column_name,
               dataType: column.data_type,
               isNullable: column.is_nullable === "YES",
               // DuckDB's is_identity is unimplemented; auto-incrementing columns
               // are the ones whose default pulls from a sequence
               isAutoIncrementing:
                  column.is_identity === "YES" || isNextvalDefault(column.column_default),
               hasDefaultValue: column.column_default !== null,
            })),
            indices: indices
               .filter((index) => index.table_name === table.table_name)
               .map((index) => ({
                  name: index.index_name,
                  table: index.table_name,
                  isUnique: index.is_unique,
                  columns: parseIndexColumns(index.expressions).map((name, order) => ({
                     name,
                     order,
                  })),
               })),
         });
      }
      return specs;
   }

   private async getIndicesInternal(): Promise<DuckdbIndex[]> {
      // constraint-backed indexes (PRIMARY KEY / UNIQUE constraints) surface in
      // duckdb_constraints(); duckdb_indexes() only lists explicit CREATE INDEX
      return await this.executeWithPlugins<DuckdbIndex[]>(sql`
         select index_name, table_name, is_unique, expressions
         from duckdb_indexes()
      `);
   }
}
