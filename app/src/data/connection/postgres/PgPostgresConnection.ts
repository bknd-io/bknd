import { Kysely, PostgresDialect } from "kysely";
import { PostgresIntrospector } from "./PostgresIntrospector";
import { PostgresConnection, plugins } from "./PostgresConnection";
import { customIntrospector } from "../Connection";
import type { Pool } from "pg";

export class PgPostgresConnection extends PostgresConnection<Pool> {
   override name = "pg";

   constructor(pool: Pool) {
      const kysely = new Kysely({
         dialect: customIntrospector(PostgresDialect, PostgresIntrospector, {
            excludeTables: [],
         }).create({ pool }),
         plugins,
      });

      super(kysely);
      this.client = pool;
   }

   override async close(): Promise<void> {
      await this.client.end();
   }
}

export function pg(pool: Pool): PgPostgresConnection {
   return new PgPostgresConnection(pool);
}
