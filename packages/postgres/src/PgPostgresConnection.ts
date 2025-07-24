import { Kysely, PostgresDialect } from "kysely";
import { PostgresIntrospector } from "./PostgresIntrospector";
import { PostgresConnection, plugins } from "./PostgresConnection";
import { customIntrospector } from "bknd/data";
import $pg from "pg";

export type PgPostgresConnectionConfig = $pg.PoolConfig;

export class PgPostgresConnection extends PostgresConnection {
   private pool: $pg.Pool;

   constructor(config: PgPostgresConnectionConfig) {
      const pool = new $pg.Pool(config);
      const kysely = new Kysely({
         dialect: customIntrospector(PostgresDialect, PostgresIntrospector, {
            excludeTables: [],
         }).create({ pool }),
         plugins,
      });

      super(kysely);
      this.pool = pool;
   }

   override async close(): Promise<void> {
      await this.pool.end();
   }
}

export function pg(config: PgPostgresConnectionConfig): PgPostgresConnection {
   return new PgPostgresConnection(config);
}
