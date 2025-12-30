import type { Entity, EntityData } from "../Entity";
import type { EntityManager } from "../EntityManager";
import { Result, type ResultJSON, type ResultOptions } from "../Result";
import type { Compilable, SelectQueryBuilder } from "kysely";
import { $console, ensureInt } from "bknd/utils";

export type RepositoryResultOptions = ResultOptions & {
   silent?: boolean;
};

export type RepositoryResultJSON<T = EntityData[]> = ResultJSON<T>;

export class RepositoryResult<T = EntityData[]> extends Result<T> {
   constructor(
      protected em: EntityManager<any>,
      public entity: Entity,
      options?: RepositoryResultOptions,
   ) {
      super(em.connection, {
         hydrator: (rows) => em.hydrate(entity.name, rows as any),
         beforeExecute: (compiled) => {
            if (!options?.silent) {
               $console.debug(`Query:\n${compiled.sql}\n`, compiled.parameters);
            }
         },
         onError: (error) => {
            if (options?.silent !== true) {
               $console.error("Repository:", String(error));
               throw error;
            }
         },
         ...options,
      });
   }

   private shouldIncludeCounts(intent?: boolean) {
      if (intent === undefined) return this.conn.supports("softscans");
      return intent;
   }

   override async execute(
      qb: SelectQueryBuilder<any, any, any>,
      opts?: { includeCounts?: boolean },
   ) {
      const includeCounts = this.shouldIncludeCounts(opts?.includeCounts);

      if (includeCounts) {
         const selector = (as = "count") => this.conn.kysely.fn.countAll<number>().as(as);
         const countQuery = qb
            .clearSelect()
            .select(selector())
            .clearLimit()
            .clearOffset()
            .clearGroupBy()
            .clearOrderBy();
         const totalQuery = this.conn.kysely.selectFrom(this.entity.name).select(selector());

         const compiled = qb.compile();
         this.options.beforeExecute?.(compiled);

         try {
            const start = performance.now();
            const [main, count, total] = await this.em.connection.executeQueries(
               compiled,
               countQuery,
               totalQuery,
            );
            this.time = Number.parseFloat((performance.now() - start).toFixed(2));
            this.results.push({
               ...main,
               data: this.options.hydrator?.(main.rows as T[]),
               items: main.rows.length,
               count: ensureInt(count.rows[0]?.count ?? 0),
               total: ensureInt(total.rows[0]?.count ?? 0),
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

         return this;
      }

      return await super.execute(qb);
   }

   get count() {
      return this.first().count;
   }

   get total() {
      return this.first().total;
   }

   protected override additionalMetaKeys(): string[] {
      return ["count", "total"];
   }
}
