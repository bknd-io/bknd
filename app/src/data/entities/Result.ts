import { isDebug } from "core/env";
import { pick } from "bknd/utils";
import type { Connection } from "data/connection";
import type {
   Compilable,
   CompiledQuery,
   QueryResult as KyselyQueryResult,
   SelectQueryBuilder,
} from "kysely";

export type ResultHydrator<T = any> = (rows: T[]) => any;
export type ResultOptions<T = any> = {
   hydrator?: ResultHydrator<T>;
   beforeExecute?: (compiled: CompiledQuery) => void | Promise<void>;
   onError?: (error: Error) => void | Promise<void>;
   single?: boolean;
};
export type ResultJSON<T = any> = {
   data: T;
   meta: {
      items: number;
      time: number;
      sql?: string;
      parameters?: any[];
      [key: string]: any;
   };
};

export interface QueryResult<T = any> extends Omit<KyselyQueryResult<T>, "rows"> {
   time: number;
   items: number;
   data: T;
   rows: unknown[];
   sql: string;
   parameters: any[];
   count?: number;
   total?: number;
}

export class Result<T = unknown> {
   results: QueryResult<T>[] = [];
   time: number = 0;

   constructor(
      protected conn: Connection,
      protected options: ResultOptions<T> = {},
   ) {}

   get(): QueryResult<T> {
      if (!this.results) {
         throw new Error("Result not executed");
      }

      if (Array.isArray(this.results)) {
         return (this.results ?? []) as any;
      }

      return this.results[0] as any;
   }

   first(): QueryResult<T> {
      const res = this.get();
      const first = Array.isArray(res) ? res[0] : res;
      return first ?? ({} as any);
   }

   get sql() {
      return this.first().sql;
   }

   get parameters() {
      return this.first().parameters;
   }

   get data() {
      if (this.options.single) {
         return this.first().data?.[0];
      }

      return this.first().data ?? [];
   }

   async execute(qb: Compilable | Compilable[]) {
      const qbs = Array.isArray(qb) ? qb : [qb];

      for (const qb of qbs) {
         const compiled = qb.compile();
         await this.options.beforeExecute?.(compiled);
         try {
            const start = performance.now();
            const res = await this.conn.executeQuery(compiled);
            this.time = Number.parseFloat((performance.now() - start).toFixed(2));
            this.results.push({
               ...res,
               data: this.options.hydrator?.(res.rows as T[]),
               items: res.rows.length,
               time: this.time,
               sql: compiled.sql,
               parameters: [...compiled.parameters],
            });
         } catch (e) {
            if (this.options.onError) {
               await this.options.onError(e as Error);
            } else {
               throw e;
            }
         }
      }

      return this;
   }

   protected additionalMetaKeys(): string[] {
      return [];
   }

   toJSON(): ResultJSON<T> {
      const { rows, data, ...metaRaw } = this.first();
      const keys = isDebug() ? ["items", "time", "sql", "parameters"] : ["items", "time"];
      const meta = pick(metaRaw, [...keys, ...this.additionalMetaKeys()] as any);
      return {
         data: this.data,
         meta,
      };
   }
}
