import type { Constructor } from "bknd/core";
import { customIntrospector, type DbFunctions } from "bknd/data";
import { Kysely, type Dialect, type KyselyPlugin } from "kysely";
import { plugins, PostgresConnection } from "./PostgresConnection";
import { PostgresIntrospector } from "./PostgresIntrospector";

export type CustomPostgresConnection = {
   supports?: PostgresConnection["supported"];
   fn?: Partial<DbFunctions>;
   plugins?: KyselyPlugin[];
   excludeTables?: string[];
};

export function createCustomPostgresConnection<
   T extends Constructor<Dialect>,
   C extends ConstructorParameters<T>[0],
>(
   dialect: Constructor<Dialect>,
   options?: CustomPostgresConnection,
): (config: C) => PostgresConnection<any> {
   const supported = {
      batching: true,
      ...((options?.supports ?? {}) as any),
   };

   return (config: C) =>
      new (class extends PostgresConnection<any> {
         protected override readonly supported = supported;

         constructor(config: C) {
            super(
               new Kysely({
                  dialect: customIntrospector(dialect, PostgresIntrospector, {
                     excludeTables: options?.excludeTables ?? [],
                  }).create(config),
                  plugins: options?.plugins ?? plugins,
               }),
               options?.fn,
               options?.plugins,
            );
         }
      })(config);
}
