import {
   Connection,
   type DbFunctions,
   type FieldSpec,
   type SchemaResponse,
   type ConnQuery,
   type ConnQueryResults,
   type Features,
} from "../Connection";
import {
   ParseJSONResultsPlugin,
   type ColumnDataType,
   type ColumnDefinitionBuilder,
   type Kysely,
   type KyselyPlugin,
   type SelectQueryBuilder,
} from "kysely";
import { jsonArrayFrom, jsonBuildObject, jsonObjectFrom } from "kysely/helpers/mysql";
import type { Field } from "data/fields/Field";

export type QB = SelectQueryBuilder<any, any, any>;

export const plugins = [new ParseJSONResultsPlugin()];

export abstract class MysqlConnection<Client = unknown> extends Connection<Client> {
   protected override readonly supported: Features = {
      batching: false,
      softscans: true,
      returning: false,
   };

   constructor(kysely: Kysely<any>, fn?: Partial<DbFunctions>, _plugins?: KyselyPlugin[]) {
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
            type = "blob";
            break;
         case "date":
         case "datetime":
            type = "timestamp";
            break;
         case "text":
            type = "varchar(255)";
            break;
      }

      return [
         spec.name,
         type,
         (col: ColumnDefinitionBuilder) => {
            if (spec.primary) {
               return col.primaryKey().notNull();
            }
            if (spec.references) {
               return col
                  .references(spec.references)
                  .onDelete(spec.onDelete ?? "set null")
                  .onUpdate(spec.onUpdate ?? "no action");
            }
            return col;
         },
      ];
   }

   override toDriver(value: unknown, field: Field): unknown {
      if (
         ((field.schema && field.schema()?.type === "date") ||
            (field.schema && field.schema()?.type === "datetime") ||
            (field.schema && field.schema()?.type === "timestamp")) &&
         value
      ) {
         if (value instanceof Date) {
            return value.toISOString().slice(0, 19).replace("T", " ");
         }
         if (typeof value === "string" && value.includes("T") && value.endsWith("Z")) {
            return value.slice(0, 19).replace("T", " ");
         }
      }
      return super.toDriver(value, field);
   }

   override async executeQueries<O extends ConnQuery[]>(...qbs: O): Promise<ConnQueryResults<O>> {
      return this.kysely.transaction().execute(async (trx) => {
         return Promise.all(qbs.map((q) => trx.executeQuery(q)));
      }) as any;
   }
}
