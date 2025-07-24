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
import type { Constructor } from "core";
import { customIntrospector } from "../Connection";
import { SqliteIntrospector } from "./SqliteIntrospector";
import type { Field } from "data/fields/Field";

// @todo: add pragmas
export type SqliteConnectionConfig<
   CustomDialect extends Constructor<Dialect> = Constructor<Dialect>,
> = {
   excludeTables?: string[];
   dialect: CustomDialect;
   dialectArgs?: ConstructorParameters<CustomDialect>;
   additionalPlugins?: KyselyPlugin[];
   customFn?: Partial<DbFunctions>;
};

export abstract class SqliteConnection<Client = unknown> extends Connection<Client> {
   override name = "sqlite";

   constructor(config: SqliteConnectionConfig) {
      const { excludeTables, dialect, dialectArgs = [], additionalPlugins } = config;
      const plugins = [new ParseJSONResultsPlugin(), ...(additionalPlugins ?? [])];

      const kysely = new Kysely({
         dialect: customIntrospector(dialect, SqliteIntrospector, {
            excludeTables,
            plugins,
         }).create(...dialectArgs),
         plugins,
      });

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
