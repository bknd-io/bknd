import type { CompiledQuery, TableMetadata } from "kysely";
import type { IndexMetadata, SchemaResponse } from "../connection/Connection";
import type { Entity, EntityManager } from "../entities";
import { PrimaryField } from "../fields";
import { $console } from "core/utils";

type IntrospectedTable = TableMetadata & {
   indices: IndexMetadata[];
};

type SchemaTable = {
   name: string;
   columns: string[];
};

type SchemaDiffTable = {
   name: string;
   isNew: boolean;
   isDrop?: boolean;
   columns: {
      add: string[];
      drop: string[];
      change: string[];
   };
   indices: {
      add: string[];
      drop: string[];
   };
};

type ColumnDiff = {
   name: string;
   changes: {
      attribute: string;
      prev: any;
      next: any;
   }[];
};

/**
 * @todo: add modified fields
 * @todo: add drop tables
 *
 * @todo: change exclude tables to startWith, then add "bknd_" tables
 */

export class SchemaManager {
   static EXCLUDE_TABLES = ["libsql_wasm_func_table", "sqlite_sequence", "_cf_KV"];

   constructor(private readonly em: EntityManager<any>) {}

   private getIntrospector() {
      return this.em.connection.getIntrospector();
   }

   async introspect(): Promise<IntrospectedTable[]> {
      const tables = await this.getIntrospector().getTables({
         withInternalKyselyTables: false,
      });

      const indices = await this.getIntrospector().getIndices();

      const cleanTables: any[] = [];
      for (const table of tables) {
         if (SchemaManager.EXCLUDE_TABLES.includes(table.name)) {
            continue;
         }

         cleanTables.push({
            ...table,
            indices: indices.filter((index) => index.table === table.name),
         });
      }

      return cleanTables;
   }

   getIntrospectionFromEntity(entity: Entity): IntrospectedTable {
      const fields = entity.getFields(false);
      const indices = this.em.getIndicesOf(entity);

      // this is intentionally setting values to defaults, like "nullable" and "default"
      // that is because sqlite is the main focus, but in the future,
      // we might want to support full sync with extensive schema updates (e.g. postgres)
      return {
         name: entity.name,
         isView: false,
         columns: fields.map((field) => ({
            name: field.name,
            dataType: "TEXT", // doesn't matter
            isNullable: true, // managed by the field
            isAutoIncrementing: field instanceof PrimaryField,
            hasDefaultValue: false, // managed by the field
            comment: undefined,
         })),
         indices: indices.map((index) => ({
            name: index.name,
            table: entity.name,
            isUnique: index.unique,
            columns: index.fields.map((f) => ({
               name: f.name,
               order: 0, // doesn't matter
            })),
         })) as any,
      };
   }

   async getDiff(): Promise<SchemaDiffTable[]> {
      const introspection = await this.introspect();
      const entityStates = this.em.entities.map((e) => this.getIntrospectionFromEntity(e));

      const diff: SchemaDiffTable[] = [];
      const namesFn = (c: { name: string }) => c.name;

      // @todo: add drop tables (beware, there a system tables!)
      introspection
         .filter((table) => {
            if (/bknd/.test(table.name) || table.isView) {
               return false;
            }
            return !entityStates.map((e) => e.name).includes(table.name);
         })
         .forEach((t) => {
            diff.push({
               name: t.name,
               isDrop: true,
               isNew: false,
               columns: {
                  add: [],
                  drop: [],
                  change: [],
               },
               indices: {
                  add: [],
                  drop: [],
               },
            });
         });

      for (const entity of entityStates) {
         const table = introspection.find((t) => t.name === entity.name);

         if (!table) {
            // If the table is completely new
            diff.push({
               name: entity.name,
               isNew: true,
               columns: {
                  add: entity.columns.map(namesFn),
                  drop: [],
                  change: [],
               },
               indices: {
                  add: entity.indices.map(namesFn),
                  drop: [],
               },
            });
         } else {
            // If the table exists, check for new columns
            const newColumns = entity.columns.filter(
               (newColumn) => !table.columns.map(namesFn).includes(newColumn.name),
            );

            // check for columns to drop
            const dropColumns = table.columns.filter(
               (oldColumn) => !entity.columns.map(namesFn).includes(oldColumn.name),
            );

            // check for changed columns
            const columnDiffs: ColumnDiff[] = [];
            for (const entity_col of entity.columns) {
               const db_col = table.columns.find((c) => c.name === entity_col.name);
               const col_diffs: ColumnDiff["changes"] = [];
               for (const [key, value] of Object.entries(entity_col)) {
                  if (db_col && db_col[key] !== value) {
                     col_diffs.push({
                        attribute: key,
                        prev: db_col[key],
                        next: value,
                     });
                  }
               }
               if (Object.keys(col_diffs).length > 0) {
                  columnDiffs.push({
                     name: entity_col.name,
                     changes: col_diffs,
                  });
               }
            }

            // new indices
            const newIndices = entity.indices.filter(
               (newIndex) => !table.indices.map((i) => i.name).includes(newIndex.name),
            );

            const dropIndices = table.indices.filter(
               (oldIndex) => !entity.indices.map((i) => i.name).includes(oldIndex.name),
            );

            const anythingChanged = [
               newColumns,
               dropColumns,
               //columnDiffs, // ignored
               newIndices,
               dropIndices,
            ].some((arr) => arr.length > 0);

            if (anythingChanged) {
               diff.push({
                  name: entity.name,
                  isNew: false,
                  columns: {
                     add: newColumns.map(namesFn),
                     drop: dropColumns.map(namesFn),
                     // @todo: this is ignored for now
                     //change: columnDiffs.map(namesFn),
                     change: [],
                  },
                  indices: {
                     add: newIndices.map(namesFn),
                     drop: dropIndices.map(namesFn),
                  },
               });
            }
         }
      }

      return diff;
   }

   private collectFieldSchemas(table: string, columns: string[]) {
      const schemas: SchemaResponse[] = [];
      if (columns.length === 0) {
         return schemas;
      }

      for (const column of columns) {
         const field = this.em.entity(table).getField(column)!;
         const fieldSchema = field.schema();
         if (fieldSchema) {
            schemas.push(this.em.connection.getFieldSchema(fieldSchema));
         }
      }

      return schemas;
   }

   async sync(config: { force?: boolean; drop?: boolean } = { force: false, drop: false }) {
      const diff = await this.getDiff();
      let updates: number = 0;
      const statements: { sql: string; parameters: readonly unknown[] }[] = [];
      const schema = this.em.connection.kysely.schema;

      for (const table of diff) {
         const qbs: { compile(): CompiledQuery; execute(): Promise<void> }[] = [];
         let local_updates: number = 0;
         const addFieldSchemas = this.collectFieldSchemas(table.name, table.columns.add);
         const dropFields = table.columns.drop;
         const dropIndices = table.indices.drop;

         if (table.isDrop) {
            updates++;
            local_updates++;
            if (config.drop) {
               qbs.push(schema.dropTable(table.name));
            }
         } else if (table.isNew) {
            let createQb = schema.createTable(table.name);
            // add fields
            for (const fieldSchema of addFieldSchemas) {
               updates++;
               local_updates++;
               // @ts-ignore
               createQb = createQb.addColumn(...fieldSchema);
            }

            qbs.push(createQb);
         } else {
            // if fields to add
            if (addFieldSchemas.length > 0) {
               // add fields
               for (const fieldSchema of addFieldSchemas) {
                  updates++;
                  local_updates++;
                  // @ts-ignore
                  qbs.push(schema.alterTable(table.name).addColumn(...fieldSchema));
               }
            }

            // if fields to drop
            if (config.drop && dropFields.length > 0) {
               // drop fields
               for (const column of dropFields) {
                  updates++;
                  local_updates++;
                  qbs.push(schema.alterTable(table.name).dropColumn(column));
               }
            }
         }

         // add indices
         for (const index of table.indices.add) {
            const indices = this.em.getIndicesOf(table.name);
            const fieldIndex = indices.find((i) => i.name === index)!;
            let qb = schema
               .createIndex(index)
               .on(table.name)
               .columns(fieldIndex.fields.map((f) => f.name));
            if (fieldIndex.unique) {
               qb = qb.unique();
            }
            qbs.push(qb);
            local_updates++;
            updates++;
         }

         // drop indices
         if (config.drop) {
            for (const index of dropIndices) {
               qbs.push(schema.dropIndex(index));
               local_updates++;
               updates++;
            }
         }

         if (local_updates === 0) continue;

         // iterate through built qbs
         // @todo: run in batches
         for (const qb of qbs) {
            const { sql, parameters } = qb.compile();
            statements.push({ sql, parameters });

            if (config.force) {
               try {
                  $console.debug("[SchemaManager]", sql);
                  await qb.execute();
               } catch (e) {
                  throw new Error(`Failed to execute query: ${sql}: ${(e as any).message}`);
               }
            }
         }
      }

      return statements;
   }
}
