import { type SchemaMetadata, sql } from "kysely";
import { BaseIntrospector } from "../BaseIntrospector";

type MySqlSchemaSpec = {
   name: string;
   type: "VIEW" | "BASE TABLE";
   columns: {
      name: string;
      type: string;
      notnull: number;
      dflt: string;
      pk: boolean;
      auto: number;
   }[];
   indices: {
      name: string;
      non_unique: number;
      columns: { name: string; seqno: number }[];
   }[];
};

export class MysqlIntrospector extends BaseIntrospector {
   async getSchemas(): Promise<SchemaMetadata[]> {
      const rawSchemas = await this.db
         .selectFrom("information_schema.schemata")
         .select("schema_name as nspname")
         .$castTo<{ nspname: string }>()
         .execute();

      return rawSchemas.map((it) => ({ name: it.nspname }));
   }

   async getSchemaSpec() {
      const query = sql`
         WITH tables_and_views AS (
            SELECT 
               TABLE_NAME AS name,
               TABLE_TYPE AS type
            FROM information_schema.tables
            WHERE TABLE_SCHEMA = DATABASE() -- Or a specific schema name
            AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')
            AND TABLE_NAME NOT IN (${this.getExcludedTableNames().join(", ")})
         ),
         columns_info AS (
            SELECT 
               TABLE_NAME AS name,
               JSON_ARRAYAGG(JSON_OBJECT(
                  'name', COLUMN_NAME,
                  'type', DATA_TYPE,
                  'notnull', (CASE WHEN IS_NULLABLE = 'NO' THEN 1 ELSE 0 END),
                  'dflt', COLUMN_DEFAULT,
                  'pk', (CASE WHEN COLUMN_KEY = 'PRI' THEN 1 ELSE 0 END),
                  'auto', (CASE WHEN EXTRA = 'auto_increment' THEN 1 ELSE 0 END)
               )) AS columns
            FROM information_schema.columns
            WHERE TABLE_SCHEMA = DATABASE()
            GROUP BY TABLE_NAME
         ),
         indices_info AS (
            SELECT 
               TABLE_NAME AS table_name,
               JSON_OBJECT(
                  'name', INDEX_NAME,
                  'non_unique', MAX(NON_UNIQUE),
                  'columns', (
                     SELECT JSON_ARRAYAGG(JSON_OBJECT(
                        'name', COLUMN_NAME,
                        'seqno', SEQ_IN_INDEX
                     ))
                     FROM information_schema.statistics s2
                     WHERE s2.TABLE_NAME = s1.TABLE_NAME 
                     AND s2.INDEX_NAME = s1.INDEX_NAME
                     AND s2.TABLE_SCHEMA = s1.TABLE_SCHEMA
                  )
               ) AS index_obj
            FROM information_schema.statistics s1
            WHERE TABLE_SCHEMA = DATABASE()
            AND INDEX_NAME != 'PRIMARY'
            GROUP BY TABLE_NAME, INDEX_NAME
         )
         SELECT 
            tv.name,
            tv.type,
            ci.columns,
            ii.indices
         FROM tables_and_views tv
         LEFT JOIN columns_info ci ON tv.name = ci.name
         LEFT JOIN (
            SELECT table_name, JSON_ARRAYAGG(index_obj) as indices 
            FROM indices_info
            GROUP BY table_name
         ) ii ON tv.name = ii.table_name;
      `;

      const tables = await this.executeWithPlugins<MySqlSchemaSpec[]>(query);

      return tables.map((table) => ({
         name: table.name,
         isView: table.type === "VIEW",
         columns: table.columns.map((col) => ({
            name: col.name,
            dataType: col.type,
            isNullable: !col.notnull,
            isAutoIncrementing: col.auto === 1,
            hasDefaultValue: col.dflt != null,
            comment: undefined,
         })),
         indices: (table.indices || [])
            .filter((index) => {
               if (index.name === "PRIMARY") return false;
               const pkCol = table.columns.find((c) => c.pk && c.name === index.name);
               if (pkCol && index.non_unique === 0) return false;
               return true;
            })
            .map((index) => ({
               name: index.name,
               table: table.name,
               isUnique: index.non_unique === 0,
               columns: index.columns.map((col) => ({
                  name: col.name,
                  order: col.seqno - 1,
               })),
            })),
      }));
   }
}
