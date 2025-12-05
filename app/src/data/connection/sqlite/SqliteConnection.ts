import {
   ParseJSONResultsPlugin,
   type ColumnDataType,
   type ColumnDefinitionBuilder,
   type Dialect,
   Kysely,
   type KyselyPlugin,
} from "kysely";
import { jsonArrayFrom, jsonBuildObject, jsonObjectFrom } from "kysely/helpers/sqlite";
import { Connection, type DbFunctions, type FieldSpec, type SchemaResponse } from "../Connection";
import type { Constructor } from "core/registry/Registry";
import { customIntrospector } from "../Connection";
import { SqliteIntrospector } from "./SqliteIntrospector";
import type { Field } from "data/fields/Field";

export type SqliteConnectionConfig<
   CustomDialect extends Constructor<Dialect> = Constructor<Dialect>,
> = {
   excludeTables?: string[];
   additionalPlugins?: KyselyPlugin[];
   customFn?: Partial<DbFunctions>;
} & (
   | {
        dialect: CustomDialect;
        dialectArgs?: ConstructorParameters<CustomDialect>;
     }
   | {
        kysely: Kysely<any>;
     }
);

export abstract class SqliteConnection<Client = unknown> extends Connection<Client> {
   override name = "sqlite";

   constructor(config: SqliteConnectionConfig) {
      const { excludeTables, additionalPlugins } = config;
      const plugins = [new ParseJSONResultsPlugin(), ...(additionalPlugins ?? [])];

      let kysely: Kysely<any>;
      if ("dialect" in config) {
         kysely = new Kysely({
            dialect: customIntrospector(config.dialect, SqliteIntrospector, {
               excludeTables,
               plugins,
            }).create(...(config.dialectArgs ?? [])),
            plugins,
         });
      } else if ("kysely" in config) {
         kysely = config.kysely;
      } else {
         throw new Error("Either dialect or kysely must be provided");
      }

      super(
         kysely,
         {
            jsonArrayFrom,
            jsonObjectFrom,
            jsonBuildObject,
            ...(config.customFn ?? {}),
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
            return col;
         },
      ] as const;
   }

   override toDriver(value: unknown, field: Field): unknown {
      if (field.type === "boolean") {
         return value ? 1 : 0;
      }
      if (typeof value === "undefined") {
         return null;
      }
      return value;
   }

   override fromDriver(value: any, field: Field): unknown {
      if (field.type === "boolean" && typeof value === "number") {
         return value === 1;
      }
      return value;
   }
}
