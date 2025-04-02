import type { DB as DefaultDB, PrimaryFieldType } from "core";
import { $console } from "core";
import { type EmitsEvents, EventManager } from "core/events";
import { type SelectQueryBuilder, sql } from "kysely";
import { cloneDeep } from "lodash-es";
import { InvalidSearchParamsException } from "../../errors";
import { MutatorEvents, RepositoryEvents } from "../../events";
import { type RepoQuery, defaultQuerySchema } from "../../server/data-query-impl";
import {
   type Entity,
   type EntityData,
   type EntityManager,
   WhereBuilder,
   WithBuilder,
} from "../index";
import { JoinBuilder } from "./JoinBuilder";
import { ensureInt } from "core/utils";

export type RepositoryQB = SelectQueryBuilder<any, any, any>;

export type RepositoryRawResponse = {
   sql: string;
   parameters: any[];
   result: EntityData[];
};
export type RepositoryResponse<T = EntityData[]> = RepositoryRawResponse & {
   entity: Entity;
   data: T;
   meta: {
      items: number;
      total?: number;
      count?: number;
      time?: number;
      query?: {
         sql: string;
         parameters: readonly any[];
      };
   };
};

export type RepositoryCountResponse = RepositoryRawResponse & {
   count: number;
};
export type RepositoryExistsResponse = RepositoryRawResponse & {
   exists: boolean;
};

export type RepositoryOptions = {
   silent?: boolean;
   includeCounts?: boolean;
   emgr?: EventManager<any>;
};

export class Repository<TBD extends object = DefaultDB, TB extends keyof TBD = any>
   implements EmitsEvents
{
   static readonly Events = RepositoryEvents;
   emgr: EventManager<typeof Repository.Events>;

   constructor(
      public em: EntityManager<TBD>,
      public entity: Entity,
      protected options: RepositoryOptions = {},
   ) {
      this.emgr = options?.emgr ?? new EventManager(MutatorEvents);
   }

   private cloneFor(entity: Entity, opts: Partial<RepositoryOptions> = {}) {
      return new Repository(this.em, this.em.entity(entity), {
         ...this.options,
         ...opts,
         emgr: this.emgr,
      });
   }

   private get conn() {
      return this.em.connection.kysely;
   }

   private checkIndex(entity: string, field: string, clause: string) {
      const indexed = this.em.getIndexedFields(entity).map((f) => f.name);
      if (!indexed.includes(field) && this.options?.silent !== true) {
         $console.warn(`Field "${entity}.${field}" used in "${clause}" is not indexed`);
      }
   }

   getValidOptions(options?: Partial<RepoQuery>): RepoQuery {
      const entity = this.entity;
      // @todo: if not cloned deep, it will keep references and error if multiple requests come in
      const validated = {
         ...cloneDeep(defaultQuerySchema),
         sort: entity.getDefaultSort(),
         select: entity.getSelect(),
      };

      if (!options) return validated;

      if (options.sort) {
         if (!validated.select.includes(options.sort.by)) {
            throw new InvalidSearchParamsException(`Invalid sort field "${options.sort.by}"`);
         }
         if (!["asc", "desc"].includes(options.sort.dir)) {
            throw new InvalidSearchParamsException(`Invalid sort direction "${options.sort.dir}"`);
         }

         this.checkIndex(entity.name, options.sort.by, "sort");
         validated.sort = options.sort;
      }

      if (options.select && options.select.length > 0) {
         const invalid = options.select.filter((field) => !validated.select.includes(field));

         if (invalid.length > 0) {
            throw new InvalidSearchParamsException(
               `Invalid select field(s): ${invalid.join(", ")}`,
            ).context({
               entity: entity.name,
               valid: validated.select,
            });
         }

         validated.select = options.select;
      }

      if (options.with) {
         const depth = WithBuilder.validateWiths(this.em, entity.name, options.with);
         // @todo: determine allowed depth
         validated.with = options.with;
      }

      if (options.join && options.join.length > 0) {
         for (const entry of options.join) {
            const related = this.em.relationOf(entity.name, entry);
            if (!related) {
               throw new InvalidSearchParamsException(
                  `JOIN: "${entry}" is not a relation of "${entity.name}"`,
               );
            }

            validated.join.push(entry);
         }
      }

      if (options.where) {
         // @todo: auto-alias base entity when using joins! otherwise "id" is ambiguous
         const aliases = [entity.name];
         if (validated.join.length > 0) {
            aliases.push(...JoinBuilder.getJoinedEntityNames(this.em, entity, validated.join));
         }

         // @todo: add tests for aliased fields in where
         const invalid = WhereBuilder.getPropertyNames(options.where).filter((field) => {
            if (field.includes(".")) {
               const [alias, prop] = field.split(".") as [string, string];
               if (!aliases.includes(alias)) {
                  return true;
               }

               this.checkIndex(alias, prop, "where");
               return !this.em.entity(alias).getField(prop);
            }

            this.checkIndex(entity.name, field, "where");
            return typeof entity.getField(field) === "undefined";
         });

         if (invalid.length > 0) {
            throw new InvalidSearchParamsException(
               `Invalid where field(s): ${invalid.join(", ")}`,
            ).context({ aliases, entity: entity.name });
         }

         validated.where = options.where;
      }

      // pass unfiltered
      if (options.limit) validated.limit = options.limit;
      if (options.offset) validated.offset = options.offset;

      return validated;
   }

   protected async executeQb(qb: RepositoryQB) {
      const compiled = qb.compile();
      if (this.options?.silent !== true) {
         $console.debug(`Repository: query\n${compiled.sql}\n`, compiled.parameters);
      }

      let result: any;
      try {
         result = await qb.execute();
      } catch (e) {
         if (this.options?.silent !== true) {
            if (e instanceof Error) {
               $console.error("[ERROR] Repository.executeQb", e.message);
            }

            throw e;
         }
      }

      return {
         result,
         sql: compiled.sql,
         parameters: [...compiled.parameters],
      };
   }

   protected async performQuery(qb: RepositoryQB): Promise<RepositoryResponse> {
      const entity = this.entity;
      const compiled = qb.compile();

      const payload = {
         entity,
         sql: compiled.sql,
         parameters: [...compiled.parameters],
         result: [],
         data: [],
         meta: {
            total: 0,
            count: 0,
            items: 0,
            time: 0,
            query: { sql: compiled.sql, parameters: compiled.parameters },
         },
      };

      // don't batch (add counts) if `includeCounts` is set to false
      // or when explicitly set to true and batching is not supported
      if (
         this.options?.includeCounts === false ||
         (this.options?.includeCounts === true && !this.em.connection.supports("batching"))
      ) {
         const start = performance.now();
         const res = await this.executeQb(qb);
         const time = Number.parseFloat((performance.now() - start).toFixed(2));
         const result = res.result ?? [];
         const data = this.em.hydrate(entity.name, result);

         return {
            ...payload,
            result,
            data,
            meta: {
               ...payload.meta,
               total: undefined,
               count: undefined,
               items: data.length,
               time,
            },
         };
      }

      if (this.options?.silent !== true) {
         $console.debug(`Repository: query\n${compiled.sql}\n`, compiled.parameters);
      }

      const selector = (as = "count") => this.conn.fn.countAll<number>().as(as);
      const countQuery = qb
         .clearSelect()
         .select(selector())
         .clearLimit()
         .clearOffset()
         .clearGroupBy()
         .clearOrderBy();
      const totalQuery = this.conn.selectFrom(entity.name).select(selector());

      try {
         const start = performance.now();
         const [_count, _total, result] = await this.em.connection.batchQuery([
            countQuery,
            totalQuery,
            qb,
         ]);

         const time = Number.parseFloat((performance.now() - start).toFixed(2));
         const data = this.em.hydrate(entity.name, result);

         return {
            ...payload,
            result,
            data,
            meta: {
               ...payload.meta,
               // parsing is important since pg returns string
               total: ensureInt(_total[0]?.count),
               count: ensureInt(_count[0]?.count),
               items: result.length,
               time,
            },
         };
      } catch (e) {
         if (this.options?.silent !== true) {
            if (e instanceof Error) {
               $console.error("[ERROR] Repository.performQuery", e.message);
            }

            throw e;
         } else {
            return payload;
         }
      }
   }

   protected async single(
      qb: RepositoryQB,
      options: RepoQuery,
   ): Promise<RepositoryResponse<EntityData>> {
      await this.emgr.emit(
         new Repository.Events.RepositoryFindOneBefore({ entity: this.entity, options }),
      );

      const { data, ...response } = await this.performQuery(qb);

      await this.emgr.emit(
         new Repository.Events.RepositoryFindOneAfter({
            entity: this.entity,
            options,
            data: data[0]!,
         }),
      );

      return { ...response, data: data[0]! };
   }

   addOptionsToQueryBuilder(
      _qb?: RepositoryQB,
      _options?: Partial<RepoQuery>,
      config?: {
         validate?: boolean;
         ignore?: (keyof RepoQuery)[];
         alias?: string;
         defaults?: Pick<RepoQuery, "limit" | "offset">;
      },
   ) {
      const entity = this.entity;
      let qb = _qb ?? (this.conn.selectFrom(entity.name) as RepositoryQB);

      const options = config?.validate !== false ? this.getValidOptions(_options) : _options;
      if (!options) return qb;

      const alias = config?.alias ?? entity.name;
      const aliased = (field: string) => `${alias}.${field}`;
      const ignore = config?.ignore ?? [];
      const defaults = {
         limit: 10,
         offset: 0,
         ...config?.defaults,
      };

      if (!ignore.includes("select") && options.select) {
         qb = qb.select(entity.getAliasedSelectFrom(options.select, alias));
      }

      if (!ignore.includes("with") && options.with) {
         qb = WithBuilder.addClause(this.em, qb, entity, options.with);
      }

      if (!ignore.includes("join") && options.join) {
         qb = JoinBuilder.addClause(this.em, qb, entity, options.join);
      }

      // add where if present
      if (!ignore.includes("where") && options.where) {
         qb = WhereBuilder.addClause(qb, options.where);
      }

      if (!ignore.includes("limit")) qb = qb.limit(options.limit ?? defaults.limit);
      if (!ignore.includes("offset")) qb = qb.offset(options.offset ?? defaults.offset);

      // sorting
      if (!ignore.includes("sort")) {
         qb = qb.orderBy(aliased(options.sort?.by ?? "id"), options.sort?.dir ?? "asc");
      }

      return qb as RepositoryQB;
   }

   private buildQuery(
      _options?: Partial<RepoQuery>,
      ignore: (keyof RepoQuery)[] = [],
   ): { qb: RepositoryQB; options: RepoQuery } {
      const entity = this.entity;
      const options = this.getValidOptions(_options);

      return {
         qb: this.addOptionsToQueryBuilder(undefined, options, {
            ignore,
            alias: entity.name,
            // already done
            validate: false,
         }),
         options,
      };
   }

   async findId(
      id: PrimaryFieldType,
      _options?: Partial<Omit<RepoQuery, "where" | "limit" | "offset">>,
   ): Promise<RepositoryResponse<TBD[TB] | undefined>> {
      const { qb, options } = this.buildQuery(
         {
            ..._options,
            where: { [this.entity.getPrimaryField().name]: id },
            limit: 1,
         },
         ["offset", "sort"],
      );

      return this.single(qb, options) as any;
   }

   async findOne(
      where: RepoQuery["where"],
      _options?: Partial<Omit<RepoQuery, "where" | "limit" | "offset">>,
   ): Promise<RepositoryResponse<TBD[TB] | undefined>> {
      const { qb, options } = this.buildQuery({
         ..._options,
         where,
         limit: 1,
      });

      return this.single(qb, options) as any;
   }

   async findMany(_options?: Partial<RepoQuery>): Promise<RepositoryResponse<TBD[TB][]>> {
      const { qb, options } = this.buildQuery(_options);

      await this.emgr.emit(
         new Repository.Events.RepositoryFindManyBefore({ entity: this.entity, options }),
      );

      const res = await this.performQuery(qb);

      await this.emgr.emit(
         new Repository.Events.RepositoryFindManyAfter({
            entity: this.entity,
            options,
            data: res.data,
         }),
      );

      return res as any;
   }

   // @todo: add unit tests, specially for many to many
   async findManyByReference(
      id: PrimaryFieldType,
      reference: string,
      _options?: Partial<Omit<RepoQuery, "limit" | "offset">>,
   ): Promise<RepositoryResponse<EntityData>> {
      const entity = this.entity;
      const listable_relations = this.em.relations.listableRelationsOf(entity);
      const relation = listable_relations.find((r) => r.ref(reference).reference === reference);

      if (!relation) {
         throw new Error(
            `Relation "${reference}" not found or not listable on entity "${entity.name}"`,
         );
      }

      const newEntity = relation.other(entity).entity;
      const refQueryOptions = relation.getReferenceQuery(newEntity, id as number, reference);
      if (!("where" in refQueryOptions) || Object.keys(refQueryOptions.where as any).length === 0) {
         throw new Error(
            `Invalid reference query for "${reference}" on entity "${newEntity.name}"`,
         );
      }

      const findManyOptions = {
         ..._options,
         ...refQueryOptions,
         where: {
            ...refQueryOptions.where,
            ..._options?.where,
         },
      };

      return this.cloneFor(newEntity).findMany(findManyOptions);
   }

   async count(where?: RepoQuery["where"]): Promise<RepositoryCountResponse> {
      const entity = this.entity;
      const options = this.getValidOptions({ where });

      const selector = this.conn.fn.count<number>(sql`*`).as("count");
      let qb = this.conn.selectFrom(entity.name).select(selector);

      // add where if present
      if (options.where) {
         qb = WhereBuilder.addClause(qb, options.where);
      }

      const { result, ...compiled } = await this.executeQb(qb);

      return {
         sql: compiled.sql,
         parameters: [...compiled.parameters],
         result,
         count: result[0]?.count ?? 0,
      };
   }

   async exists(where: Required<RepoQuery["where"]>): Promise<RepositoryExistsResponse> {
      const entity = this.entity;
      const options = this.getValidOptions({ where });

      const selector = this.conn.fn.count<number>(sql`*`).as("count");
      let qb = this.conn.selectFrom(entity.name).select(selector);

      // add mandatory where
      qb = WhereBuilder.addClause(qb, options.where).limit(1);

      const { result, ...compiled } = await this.executeQb(qb);

      return {
         sql: compiled.sql,
         parameters: [...compiled.parameters],
         result,
         exists: result[0]!.count > 0,
      };
   }
}
