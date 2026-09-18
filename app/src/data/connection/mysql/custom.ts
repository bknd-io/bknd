import { customIntrospector, type DbFunctions } from "../Connection";
import { Kysely, type Dialect, type KyselyPlugin } from "kysely";
import { plugins, MysqlConnection } from "./MysqlConnection";
import { MysqlIntrospector } from "./MysqlIntrospector";

export type Constructor<T> = new (...args: any[]) => T;

export type CustomMysqlConnection = {
   supports?: Partial<MysqlConnection["supported"]>;
   fn?: Partial<DbFunctions>;
   plugins?: KyselyPlugin[];
   excludeTables?: string[];
};

export function createCustomMySqlConnection<
   T extends Constructor<Dialect>,
   C extends ConstructorParameters<T>[0],
>(
   name: string,
   dialect: Constructor<Dialect>,
   options?: CustomMysqlConnection,
): (config: C) => MysqlConnection {
   const supported = {
      batching: true,
      ...((options?.supports ?? {}) as any),
   };

   return (config: C) =>
      new (class extends MysqlConnection {
         override name = name;
         override readonly supported = supported;

         constructor(config: C) {
            super(
               new Kysely({
                  dialect: customIntrospector(dialect, MysqlIntrospector, {
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
