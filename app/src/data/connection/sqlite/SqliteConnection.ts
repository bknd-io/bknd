import type { ColumnDataType, ColumnDefinitionBuilder, Kysely, KyselyPlugin } from "kysely";
import { jsonArrayFrom, jsonBuildObject, jsonObjectFrom } from "kysely/helpers/sqlite";
import { Connection, type DbFunctions, type FieldSpec, type SchemaResponse } from "../Connection";

export class SqliteConnection extends Connection {
   constructor(kysely: Kysely<any>, fn: Partial<DbFunctions> = {}, plugins: KyselyPlugin[] = []) {
      super(
         kysely,
         {
            ...fn,
            jsonArrayFrom,
            jsonObjectFrom,
            jsonBuildObject,
         },
         plugins,
      );
   }

   override getFieldSchema(spec: FieldSpec): SchemaResponse {
      this.validateFieldSpecType(spec.type);
      let type: ColumnDataType = spec.type;

      switch (spec.type) {
         case "json":
            type = "text";
            break;
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
            if (spec.references) {
               let relCol = col.references(spec.references);
               if (spec.onDelete) relCol = relCol.onDelete(spec.onDelete);
               if (spec.onUpdate) relCol = relCol.onUpdate(spec.onUpdate);
               return relCol;
            }
            return spec.nullable ? col : col.notNull();
         },
      ] as const;
   }
}
