import { customIntrospector, type DbFunctions } from "bknd";
import { Kysely, type Dialect, type KyselyPlugin } from "kysely";
import { plugins, PostgresConnection } from "./PostgresConnection";
import { PostgresIntrospector } from "./PostgresIntrospector";

export type Constructor<T> = new (...args: any[]) => T;

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
   name: string,
   dialect: Constructor<Dialect>,
   options?: CustomPostgresConnection,
): (config: C) => PostgresConnection {
   const supported = {
      batching: true,
      ...((options?.supports ?? {}) as any),
   };

   return (config: C) =>
      new (class extends PostgresConnection {
         override name = name;
         override readonly supported = supported;

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
