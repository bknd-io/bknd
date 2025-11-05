import { Kysely } from "kysely";
import { PostgresIntrospector } from "./PostgresIntrospector";
import { PostgresConnection, plugins } from "./PostgresConnection";
import { customIntrospector } from "../Connection";
import { PostgresJSDialect } from "kysely-postgres-js";
import type { Sql } from "postgres";

export class PostgresJsConnection extends PostgresConnection<Sql> {
   override name = "postgres-js";

   constructor(opts: { postgres: Sql }) {
      const kysely = new Kysely({
         dialect: customIntrospector(PostgresJSDialect, PostgresIntrospector, {
            excludeTables: [],
         }).create({ postgres: opts.postgres }),
         plugins,
      });

      super(kysely);
      this.client = opts.postgres;
   }

   override async close(): Promise<void> {
      await this.client.end();
   }
}

export function postgresJs(
   postgres: Sql,
): PostgresJsConnection {
   return new PostgresJsConnection({ postgres });
}
