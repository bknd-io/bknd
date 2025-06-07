import { Connection, type DbFunctions, type FieldSpec, type SchemaResponse } from "bknd/data";
import {
   ParseJSONResultsPlugin,
   type ColumnDataType,
   type ColumnDefinitionBuilder,
   type Kysely,
   type KyselyPlugin,
   type SelectQueryBuilder,
} from "kysely";
import { jsonArrayFrom, jsonBuildObject, jsonObjectFrom } from "kysely/helpers/postgres";

export type QB = SelectQueryBuilder<any, any, any>;

export const plugins = [new ParseJSONResultsPlugin()];

export abstract class PostgresConnection<DB = any> extends Connection<DB> {
   protected override readonly supported = {
      batching: true,
   };

   constructor(kysely: Kysely<DB>, fn?: Partial<DbFunctions>, _plugins?: KyselyPlugin[]) {
      super(
         kysely,
         fn ?? {
            jsonArrayFrom,
            jsonBuildObject,
            jsonObjectFrom,
         },
         _plugins ?? plugins,
      );
   }

   override getFieldSchema(spec: FieldSpec): SchemaResponse {
      this.validateFieldSpecType(spec.type);
      let type: ColumnDataType = spec.type;

      if (spec.primary) {
         if (spec.type === "integer") {
            type = "serial";
         }
      }

      switch (spec.type) {
         case "blob":
            type = "bytea";
            break;
         case "date":
         case "datetime":
            // https://www.postgresql.org/docs/17/datatype-datetime.html
            type = "timestamp";
            break;
         case "text":
            // https://www.postgresql.org/docs/17/datatype-character.html
            type = "varchar";
            break;
      }

      return [
         spec.name,
         type,
         (col: ColumnDefinitionBuilder) => {
            if (spec.primary) {
               return col.primaryKey();
            }
            if (spec.references) {
               return col
                  .references(spec.references)
                  .onDelete(spec.onDelete ?? "set null")
                  .onUpdate(spec.onUpdate ?? "no action");
            }
            return spec.nullable ? col : col.notNull();
         },
      ];
   }

   protected override async batch<Queries extends QB[]>(
      queries: [...Queries],
   ): Promise<{
      [K in keyof Queries]: Awaited<ReturnType<Queries[K]["execute"]>>;
   }> {
      return this.kysely.transaction().execute(async (trx) => {
         return Promise.all(queries.map((q) => trx.executeQuery(q).then((r) => r.rows)));
      }) as any;
   }
}
