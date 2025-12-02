import { Kysely, PostgresDialect, type PostgresDialectConfig as KyselyPostgresDialectConfig } from "kysely";
import { PostgresIntrospector } from "./PostgresIntrospector";
import { PostgresConnection, plugins } from "./PostgresConnection";
import { customIntrospector } from "../Connection";
import type { Pool } from "pg";

export type PostgresDialectConfig = Omit<KyselyPostgresDialectConfig, "pool"> & {
   pool: Pool;
};

export class PgPostgresConnection extends PostgresConnection<Pool> {
   override name = "pg";

   constructor(config: PostgresDialectConfig) {
      const kysely = new Kysely({
         dialect: customIntrospector(PostgresDialect, PostgresIntrospector, {
            excludeTables: [],
         }).create(config),
         plugins,
      });

      super(kysely);
      this.client = config.pool;
   }

   override async close(): Promise<void> {
      await this.client.end();
   }
}

export function pg(config: PostgresDialectConfig): PgPostgresConnection {
   return new PgPostgresConnection(config);
}
