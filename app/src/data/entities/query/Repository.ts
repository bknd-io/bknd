import type { DB as DefaultDB, PrimaryFieldType } from "bknd";
import { $console } from "bknd/utils";
import { type EmitsEvents, EventManager } from "core/events";
import { type SelectQueryBuilder, sql } from "kysely";
import { InvalidSearchParamsException } from "../../errors";
import { MutatorEvents, RepositoryEvents } from "../../events";
import { type RepoQuery, getRepoQueryTemplate } from "data/server/query";
import {
   type Entity,
   type EntityData,
   type EntityManager,
   WhereBuilder,
   WithBuilder,
} from "../index";
import { JoinBuilder } from "./JoinBuilder";
import { RepositoryResult, type RepositoryResultOptions } from "./RepositoryResult";

export type RepositoryQB = SelectQueryBuilder<any, any, any>;

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
         ...structuredClone(getRepoQueryTemplate()),
         sort: entity.getDefaultSort(),
         select: entity.getSelect(),
      } satisfies Required<RepoQuery>;

      if (!options) return validated;

      if (options.sort) {
         if (!validated.select.includes(options.sort.by)) {
            throw new InvalidSearchParamsException(`Invalid sort field "${options.sort.by}"`);
         }
         if (!["asc", "desc"].includes(options.sort.dir!)) {
            throw new InvalidSearchParamsException(`Invalid sort direction "${options.sort.dir}"`);
         }

         this.checkIndex(entity.name, options.sort.by, "sort");
         validated.sort = {
            dir: options.sort.dir ?? "asc",
            by: options.sort.by,
         };
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
         if (validated.join?.length > 0) {
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

   protected async performQuery<T = EntityData[]>(
      qb: RepositoryQB,
      opts?: RepositoryResultOptions,
      execOpts?: { includeCounts?: boolean },
   ): Promise<RepositoryResult<T>> {
      const result = new RepositoryResult(this.em, this.entity, {
         silent: this.options.silent,
         ...opts,
      });
      return (await result.execute(qb, {
         includeCounts: execOpts?.includeCounts ?? this.options.includeCounts,
      })) as any;
   }

   private async triggerFindBefore(entity: Entity, options: RepoQuery): Promise<void> {
      const event =
         options.limit === 1
            ? Repository.Events.RepositoryFindOneBefore
            : Repository.Events.RepositoryFindManyBefore;
      await this.emgr.emit(new event({ entity, options }));
   }

   private async triggerFindAfter(
      entity: Entity,
      options: RepoQuery,
      data: EntityData[],
   ): Promise<void> {
      if (options.limit === 1) {
         await this.emgr.emit(
            new Repository.Events.RepositoryFindOneAfter({ entity, options, data }),
         );
      } else {
         await this.emgr.emit(
            new Repository.Events.RepositoryFindManyAfter({ entity, options, data }),
         );
      }
   }

   protected async single(
      qb: RepositoryQB,
      options: RepoQuery,
   ): Promise<RepositoryResult<TBD[TB] | undefined>> {
      await this.triggerFindBefore(this.entity, options);
      const result = await this.performQuery(qb, { single: true });
      await this.triggerFindAfter(this.entity, options, result.data);
      return result as any;
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

      if (!ignore.includes("limit")) {
         qb = qb.limit(options.limit ?? defaults.limit);
         if (!ignore.includes("offset")) qb = qb.offset(options.offset ?? defaults.offset);
      }

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
   ): Promise<RepositoryResult<TBD[TB] | undefined>> {
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
   ): Promise<RepositoryResult<TBD[TB] | undefined>> {
      const { qb, options } = this.buildQuery({
         ..._options,
         where,
         limit: 1,
      });

      return (await this.single(qb, options)) as any;
   }

   async findMany(_options?: Partial<RepoQuery>): Promise<RepositoryResult<TBD[TB][]>> {
      const { qb, options } = this.buildQuery(_options);
      await this.triggerFindBefore(this.entity, options);

      const res = await this.performQuery(qb);

      await this.triggerFindAfter(this.entity, options, res.data);
      return res as any;
   }

   // @todo: add unit tests, specially for many to many
   async findManyByReference(
      id: PrimaryFieldType,
      reference: string,
      _options?: Partial<Omit<RepoQuery, "limit" | "offset">>,
   ): Promise<RepositoryResult<EntityData>> {
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
            ...(_options?.where ?? {}),
         },
      };

      return this.cloneFor(newEntity).findMany(findManyOptions) as any;
   }

   async count(where?: RepoQuery["where"]): Promise<RepositoryResult<{ count: number }>> {
      const entity = this.entity;
      const options = this.getValidOptions({ where });

      const selector = this.conn.fn.count<number>(sql`*`).as("count");
      let qb = this.conn.selectFrom(entity.name).select(selector);

      // add where if present
      if (options.where) {
         qb = WhereBuilder.addClause(qb, options.where);
      }

      return await this.performQuery(
         qb,
         {
            hydrator: (rows) => ({ count: rows[0]?.count ?? 0 }),
         },
         { includeCounts: false },
      );
   }

   async exists(
      where: Required<RepoQuery>["where"],
   ): Promise<RepositoryResult<{ exists: boolean }>> {
      const entity = this.entity;
      const options = this.getValidOptions({ where });

      const selector = this.conn.fn.count<number>(sql`*`).as("count");
      let qb = this.conn.selectFrom(entity.name).select(selector);

      // add mandatory where
      qb = WhereBuilder.addClause(qb, options.where!).limit(1);

      return await this.performQuery(qb, {
         hydrator: (rows) => ({ exists: rows[0]?.count > 0 }),
      });
   }
}
