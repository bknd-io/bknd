import { Kysely, PostgresDialect } from "kysely";
import { PostgresIntrospector } from "./PostgresIntrospector";
import { PostgresConnection, plugins } from "./PostgresConnection";
import { customIntrospector } from "../Connection";
import $pg from "pg";

export type PgPostgresConnectionConfig = $pg.PoolConfig;

export class PgPostgresConnection extends PostgresConnection<$pg.Pool> {
   override name = "pg";

   constructor(config: PgPostgresConnectionConfig) {
      const pool = new $pg.Pool(config);
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

export function pg(config: PgPostgresConnectionConfig): PgPostgresConnection {
   return new PgPostgresConnection(config);
}
