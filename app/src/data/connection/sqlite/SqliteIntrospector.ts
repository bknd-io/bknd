import { type SchemaMetadata, sql } from "kysely";
import { BaseIntrospector } from "../BaseIntrospector";

export type SqliteSchemaSpec = {
   name: string;
   type: "table" | "view";
   sql: string;
   columns: {
      name: string;
      type: string;
      notnull: number;
      dflt_value: any;
      pk: number;
   }[];
   indices: {
      name: string;
      origin: string;
      partial: number;
      sql: string;
      columns: { name: string; seqno: number }[];
   }[];
};

export class SqliteIntrospector extends BaseIntrospector {
   async getSchemas(): Promise<SchemaMetadata[]> {
      // Sqlite doesn't support schemas.
      return [];
   }

   async getSchemaSpec() {
      const ext = this.getExcludedTableNames()
         .map((it) => `'${it}'`)
         .join(", ");

      const query = sql`
         SELECT m.name, m.type, m.sql,
            (SELECT json_group_array(
               json_object(
                  'name', p.name,
                  'type', p.type,
                  'notnull', p."notnull",
                  'default', p.dflt_value,
                  'primary_key', p.pk
               )) FROM pragma_table_info(m.name) p) AS columns,
            (SELECT json_group_array(
               json_object(
                  'name', i.name,
                  'origin', i.origin,
                  'partial', i.partial,
                  'sql', im.sql,
                  'columns', (SELECT json_group_array(
                     json_object(
                        'name', ii.name,
                        'seqno', ii.seqno
                     )) FROM pragma_index_info(i.name) ii)
               )) FROM pragma_index_list(m.name) i
                 LEFT JOIN sqlite_master im ON im.name = i.name
                  AND im.type = 'index'
            ) AS indices
         FROM sqlite_master m
         WHERE m.type IN ('table', 'view')
           and m.name not like 'sqlite_%'
           and m.name not in (${sql.raw(ext)})
      `;

      const tables = await this.executeWithPlugins<SqliteSchemaSpec[]>(query);

      return tables.map((table) => ({
         name: table.name,
         isView: table.type === "view",
         columns:
            table.columns?.map((col) => {
               const autoIncrementCol = table.sql
                  ?.split(/[\(\),]/)
                  ?.find((it) => it.toLowerCase().includes("autoincrement"))
                  ?.trimStart()
                  ?.split(/\s+/)?.[0]
                  ?.replace(/["`]/g, "");

               return {
                  name: col.name,
                  dataType: col.type,
                  isNullable: !col.notnull,
                  isAutoIncrementing: col.name === autoIncrementCol,
                  hasDefaultValue: col.dflt_value != null,
                  comment: undefined,
               };
            }) ?? [],
         indices:
            table.indices?.map((index) => ({
               name: index.name,
               table: table.name,
               isUnique: index.sql?.match(/unique/i) != null,
               columns: index.columns.map((col) => ({
                  name: col.name,
                  order: col.seqno,
               })),
            })) ?? [],
      }));
   }
}
