import type { KyselyPlugin } from "kysely";
import {
   type IGenericSqlite,
   type OnCreateConnection,
   type Promisable,
   parseBigInt,
   buildQueryFn,
   GenericSqliteDialect,
} from "kysely-generic-sqlite";
import { SqliteConnection } from "./SqliteConnection";
import type { Features } from "../Connection";

export type { IGenericSqlite };
export type GenericSqliteConnectionConfig = {
   name: string;
   additionalPlugins?: KyselyPlugin[];
   excludeTables?: string[];
   onCreateConnection?: OnCreateConnection;
   supports?: Partial<Features>;
};

export class GenericSqliteConnection<DB = unknown> extends SqliteConnection<DB> {
   override name = "generic-sqlite";

   constructor(
      db: DB,
      executor: () => Promisable<IGenericSqlite>,
      config?: GenericSqliteConnectionConfig,
   ) {
      super({
         dialect: GenericSqliteDialect,
         dialectArgs: [executor, config?.onCreateConnection],
         additionalPlugins: config?.additionalPlugins,
         excludeTables: config?.excludeTables,
      });
      this.client = db;
      if (config?.name) {
         this.name = config.name;
      }
      if (config?.supports) {
         for (const [key, value] of Object.entries(config.supports)) {
            if (value) {
               this.supported[key] = value;
            }
         }
      }
   }
}

export function genericSqlite<DB>(
   name: string,
   db: DB,
   executor: (utils: typeof genericSqliteUtils) => Promisable<IGenericSqlite<DB>>,
   config?: GenericSqliteConnectionConfig,
) {
   return new GenericSqliteConnection(db, () => executor(genericSqliteUtils), {
      name,
      ...config,
   });
}

export const genericSqliteUtils = {
   parseBigInt,
   buildQueryFn,
};
