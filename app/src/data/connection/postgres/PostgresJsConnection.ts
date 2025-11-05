import { Kysely } from "kysely";
import { PostgresIntrospector } from "./PostgresIntrospector";
import { PostgresConnection, plugins } from "./PostgresConnection";
import { customIntrospector } from "../Connection";
import { PostgresJSDialect, type PostgresJSDialectConfig } from "kysely-postgres-js";

export class PostgresJsConnection extends PostgresConnection<PostgresJSDialectConfig["postgres"]> {
   override name = "postgres-js";

   constructor(config: PostgresJSDialectConfig) {
      const kysely = new Kysely({
         dialect: customIntrospector(PostgresJSDialect, PostgresIntrospector, {
            excludeTables: [],
         }).create(config),
         plugins,
      });

      super(kysely);
      this.client = config.postgres;
   }

   override async close(): Promise<void> {
      await this.client.end();
   }
}

export function postgresJs(
   config: PostgresJSDialectConfig,
): PostgresJsConnection {
   return new PostgresJsConnection(config);
}
