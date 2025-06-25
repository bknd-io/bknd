import type { KyselyPlugin, QueryResult } from "kysely";
import {
   type IGenericSqlite,
   type OnCreateConnection,
   type Promisable,
   parseBigInt,
   buildQueryFn,
   GenericSqliteDialect,
} from "kysely-generic-sqlite";
import { SqliteConnection } from "./SqliteConnection";
import type { ConnQuery, ConnQueryResults, Features } from "../Connection";

export type { IGenericSqlite };
export type TStatement = { sql: string; parameters?: any[] | readonly any[] };
export interface IGenericCustomSqlite<DB = unknown> extends IGenericSqlite<DB> {
   batch?: (stmts: TStatement[]) => Promisable<QueryResult<any>[]>;
}

export type GenericSqliteConnectionConfig = {
   name?: string;
   additionalPlugins?: KyselyPlugin[];
   excludeTables?: string[];
   onCreateConnection?: OnCreateConnection;
   supports?: Partial<Features>;
};

export class GenericSqliteConnection<DB = unknown> extends SqliteConnection<DB> {
   override name = "generic-sqlite";
   #executor: IGenericCustomSqlite<DB> | undefined;

   constructor(
      public db: DB,
      private executor: () => Promisable<IGenericCustomSqlite<DB>>,
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
            if (value !== undefined) {
               this.supported[key] = value;
            }
         }
      }
   }
   private async getExecutor() {
      if (!this.#executor) {
         this.#executor = await this.executor();
      }
      return this.#executor;
   }

   override async executeQueries<O extends ConnQuery[]>(...qbs: O): Promise<ConnQueryResults<O>> {
      const executor = await this.getExecutor();
      if (!executor.batch) {
         console.warn("Batching is not supported by this database");
         return super.executeQueries(...qbs);
      }

      const compiled = this.getCompiled(...qbs);
      const stms: TStatement[] = compiled.map((q) => {
         return {
            sql: q.sql,
            parameters: q.parameters as any[],
         };
      });

      const results = await executor.batch(stms);
      return this.withTransformedRows(results) as any;
   }
}

export function genericSqlite<DB>(
   name: string,
   db: DB,
   executor: (utils: typeof genericSqliteUtils) => Promisable<IGenericCustomSqlite<DB>>,
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
