import {
   Kysely,
   PostgresDialect,
   type DatabaseIntrospector,
   type ColumnDataType,
   type ColumnDefinitionBuilder,
   ParseJSONResultsPlugin,
} from "kysely";
import pg from "pg";
import { PostgresIntrospector } from "./PostgresIntrospector";
import {
   type FieldSpec,
   type SchemaResponse,
   Connection,
   type QB,
} from "data/connection/Connection";

export type PostgresConnectionConfig = pg.PoolConfig;

const plugins = [new ParseJSONResultsPlugin()];

class CustomPostgresDialect extends PostgresDialect {
   override createIntrospector(db: Kysely<any>): DatabaseIntrospector {
      return new PostgresIntrospector(db);
   }
}

export class PostgresConnection extends Connection {
   private pool: pg.Pool;

   constructor(config: PostgresConnectionConfig) {
      const pool = new pg.Pool(config);
      const kysely = new Kysely({
         dialect: new CustomPostgresDialect({
            pool,
         }),
         plugins,
         //log: ["query", "error"],
      });

      super(kysely, {}, plugins);
      this.pool = pool;
   }

   override supportsIndices(): boolean {
      return true;
   }

   override getFieldSchema(spec: FieldSpec): SchemaResponse {
      this.validateFieldSpecType(spec.type);
      let type: ColumnDataType = spec.primary ? "serial" : spec.type;

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

   override supportsBatching(): boolean {
      return true;
   }

   override async close(): Promise<void> {
      await this.pool.end();
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
