import { Kysely } from "kysely";
import { PostgresIntrospector } from "./PostgresIntrospector";
import { PostgresConnection, plugins } from "./PostgresConnection";
import { customIntrospector } from "bknd/data";
import { PostgresJSDialect } from "kysely-postgres-js";
import $postgresJs, { type Sql, type Options, type PostgresType } from "postgres";

export type PostgresJsConfig = Options<Record<string, PostgresType>>;

export class PostgresJsConnection extends PostgresConnection {
   private postgres: Sql;

   constructor(opts: { postgres: Sql }) {
      const kysely = new Kysely({
         dialect: customIntrospector(PostgresJSDialect, PostgresIntrospector, {
            excludeTables: [],
         }).create({ postgres: opts.postgres }),
         plugins,
      });

      super(kysely);
      this.postgres = opts.postgres;
   }

   override async close(): Promise<void> {
      await this.postgres.end();
   }
}

export function postgresJs(
   connectionString: string,
   config?: PostgresJsConfig,
): PostgresJsConnection;
export function postgresJs(config: PostgresJsConfig): PostgresJsConnection;
export function postgresJs(
   first: PostgresJsConfig | string,
   second?: PostgresJsConfig,
): PostgresJsConnection {
   const postgres = typeof first === "string" ? $postgresJs(first, second) : $postgresJs(first);
   return new PostgresJsConnection({ postgres });
}
