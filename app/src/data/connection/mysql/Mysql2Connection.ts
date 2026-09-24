import {
   Kysely,
   MysqlDialect,
   type MysqlDialectConfig as KyselyMysqlDialectDialectConfig,
} from "kysely";
import { MysqlIntrospector } from "./MysqlIntrospector";
import { MysqlConnection, plugins } from "./MysqlConnection";
import { customIntrospector } from "../Connection";
import type { Pool } from "mysql2";

export type MysqlDialectConfig = Omit<KyselyMysqlDialectDialectConfig, "pool"> & {
   pool: Pool;
};

export class Mysql2Connection extends MysqlConnection<Pool> {
   override name = "mysql2";

   constructor(config: MysqlDialectConfig) {
      const kysely = new Kysely({
         dialect: customIntrospector(MysqlDialect, MysqlIntrospector, {
            excludeTables: [],
            // casting type because the types in mysql2 and mysql2/promise are different
         }).create(config as KyselyMysqlDialectDialectConfig),
         plugins,
      });

      super(kysely);
      this.client = config.pool;
   }

   override async close(): Promise<void> {
      await this.client.end();
   }
}

export function mysql2(config: MysqlDialectConfig): Mysql2Connection {
   return new Mysql2Connection(config);
}
