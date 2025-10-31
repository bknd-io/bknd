import {
   Connection,
   type DbFunctions,
   type FieldSpec,
   type SchemaResponse,
   type ConnQuery,
   type ConnQueryResults,
} from "bknd";
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

export abstract class PostgresConnection<Client = unknown> extends Connection<Client> {
   protected override readonly supported = {
      batching: true,
      softscans: true,
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

   override async executeQueries<O extends ConnQuery[]>(...qbs: O): Promise<ConnQueryResults<O>> {
      return this.kysely.transaction().execute(async (trx) => {
         return Promise.all(qbs.map((q) => trx.executeQuery(q)));
      }) as any;
   }
}
