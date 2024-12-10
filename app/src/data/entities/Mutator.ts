import type { PrimaryFieldType } from "core";
import { type EmitsEvents, EventManager } from "core/events";
import type { DeleteQueryBuilder, InsertQueryBuilder, UpdateQueryBuilder } from "kysely";
import { type TActionContext, WhereBuilder } from "..";
import type { Entity, EntityData, EntityManager } from "../entities";
import { InvalidSearchParamsException } from "../errors";
import { MutatorEvents } from "../events";
import { RelationMutator } from "../relations";
import type { RepoQuery } from "../server/data-query-impl";

type MutatorQB =
   | InsertQueryBuilder<any, any, any>
   | UpdateQueryBuilder<any, any, any, any>
   | DeleteQueryBuilder<any, any, any>;

type MutatorUpdateOrDelete =
   | UpdateQueryBuilder<any, any, any, any>
   | DeleteQueryBuilder<any, any, any>;

export type MutatorResponse<T = EntityData[]> = {
   entity: Entity;
   sql: string;
   parameters: any[];
   result: EntityData[];
   data: T;
};

export class Mutator<DB> implements EmitsEvents {
   em: EntityManager<DB>;
   entity: Entity;
   static readonly Events = MutatorEvents;
   emgr: EventManager<typeof MutatorEvents>;

   // @todo: current hacky workaround to disable creation of system entities
   __unstable_disable_system_entity_creation = true;
   __unstable_toggleSystemEntityCreation(value: boolean) {
      this.__unstable_disable_system_entity_creation = value;
   }

   constructor(em: EntityManager<DB>, entity: Entity, emgr?: EventManager<any>) {
      this.em = em;
      this.entity = entity;
      this.emgr = emgr ?? new EventManager(MutatorEvents);
   }

   private get conn() {
      return this.em.connection.kysely;
   }

   async getValidatedData(data: EntityData, context: TActionContext): Promise<EntityData> {
      const entity = this.entity;
      if (!context) {
         throw new Error("Context must be provided for validation");
      }

      const keys = Object.keys(data);
      const validatedData: EntityData = {};

      // get relational references/keys
      const relationMutator = new RelationMutator(entity, this.em);
      const relational_keys = relationMutator.getRelationalKeys();

      for (const key of keys) {
         if (relational_keys.includes(key)) {
            const result = await relationMutator.persistRelation(key, data[key]);

            // if relation field (include key and value in validatedData)
            if (Array.isArray(result)) {
               //console.log("--- (instructions)", result);
               const [relation_key, relation_value] = result;
               validatedData[relation_key] = relation_value;
            }
            continue;
         }

         const field = entity.getField(key);
         if (!field) {
            throw new Error(
               `Field "${key}" not found on entity "${entity.name}". Fields: ${entity
                  .getFillableFields()
                  .map((f) => f.name)
                  .join(", ")}`
            );
         }

         // we should never get here, but just to be sure (why?)
         if (!field.isFillable(context)) {
            throw new Error(`Field "${key}" is not fillable on entity "${entity.name}"`);
         }

         validatedData[key] = await field.transformPersist(data[key], this.em, context);
      }

      if (Object.keys(validatedData).length === 0) {
         throw new Error(`No data left to update "${entity.name}"`);
      }

      return validatedData;
   }

   protected async many(qb: MutatorQB): Promise<MutatorResponse> {
      const entity = this.entity;
      const { sql, parameters } = qb.compile();
      //console.log("mutatoar:exec", sql, parameters);
      const result = await qb.execute();

      const data = this.em.hydrate(entity.name, result) as EntityData[];

      return {
         entity,
         sql,
         parameters: [...parameters],
         result: result,
         data
      };
   }

   protected async single(qb: MutatorQB): Promise<MutatorResponse<EntityData>> {
      const { data, ...response } = await this.many(qb);
      return { ...response, data: data[0]! };
   }

   async insertOne(data: EntityData): Promise<MutatorResponse<EntityData>> {
      const entity = this.entity;
      if (entity.type === "system" && this.__unstable_disable_system_entity_creation) {
         throw new Error(`Creation of system entity "${entity.name}" is disabled`);
      }

      // @todo: establish the original order from "data"
      const validatedData = {
         ...entity.getDefaultObject(),
         ...(await this.getValidatedData(data, "create"))
      };

      await this.emgr.emit(new Mutator.Events.MutatorInsertBefore({ entity, data: validatedData }));

      // check if required fields are present
      const required = entity.getRequiredFields();
      for (const field of required) {
         if (
            typeof validatedData[field.name] === "undefined" ||
            validatedData[field.name] === null
         ) {
            throw new Error(`Field "${field.name}" is required`);
         }
      }

      const query = this.conn
         .insertInto(entity.name)
         .values(validatedData)
         .returning(entity.getSelect());

      const res = await this.single(query);

      await this.emgr.emit(new Mutator.Events.MutatorInsertAfter({ entity, data: res.data }));

      return res;
   }

   async updateOne(id: PrimaryFieldType, data: EntityData): Promise<MutatorResponse<EntityData>> {
      const entity = this.entity;
      if (!Number.isInteger(id)) {
         throw new Error("ID must be provided for update");
      }

      const validatedData = await this.getValidatedData(data, "update");

      await this.emgr.emit(
         new Mutator.Events.MutatorUpdateBefore({ entity, entityId: id, data: validatedData })
      );

      const query = this.conn
         .updateTable(entity.name)
         .set(validatedData)
         .where(entity.id().name, "=", id)
         .returning(entity.getSelect());

      const res = await this.single(query);

      await this.emgr.emit(
         new Mutator.Events.MutatorUpdateAfter({ entity, entityId: id, data: res.data })
      );

      return res;
   }

   async deleteOne(id: PrimaryFieldType): Promise<MutatorResponse<EntityData>> {
      const entity = this.entity;
      if (!Number.isInteger(id)) {
         throw new Error("ID must be provided for deletion");
      }

      await this.emgr.emit(new Mutator.Events.MutatorDeleteBefore({ entity, entityId: id }));

      const query = this.conn
         .deleteFrom(entity.name)
         .where(entity.id().name, "=", id)
         .returning(entity.getSelect());

      const res = await this.single(query);

      await this.emgr.emit(
         new Mutator.Events.MutatorDeleteAfter({ entity, entityId: id, data: res.data })
      );

      return res;
   }

   private getValidOptions(options?: Partial<RepoQuery>): Partial<RepoQuery> {
      const entity = this.entity;
      const validated: Partial<RepoQuery> = {};

      if (options?.where) {
         // @todo: add tests for aliased fields in where
         const invalid = WhereBuilder.getPropertyNames(options.where).filter((field) => {
            return typeof entity.getField(field) === "undefined";
         });

         if (invalid.length > 0) {
            throw new InvalidSearchParamsException(`Invalid where field(s): ${invalid.join(", ")}`);
         }

         validated.where = options.where;
      }

      return validated;
   }

   private appendWhere<QB extends MutatorUpdateOrDelete>(qb: QB, _where?: RepoQuery["where"]): QB {
      const entity = this.entity;

      const alias = entity.name;
      const aliased = (field: string) => `${alias}.${field}`;

      // add where if present
      if (_where) {
         // @todo: add tests for aliased fields in where
         const invalid = WhereBuilder.getPropertyNames(_where).filter((field) => {
            return typeof entity.getField(field) === "undefined";
         });

         if (invalid.length > 0) {
            throw new InvalidSearchParamsException(`Invalid where field(s): ${invalid.join(", ")}`);
         }

         return WhereBuilder.addClause(qb, _where);
      }

      return qb;
   }

   // @todo: decide whether entries should be deleted all at once or one by one (for events)
   async deleteWhere(where?: RepoQuery["where"]): Promise<MutatorResponse<EntityData>> {
      const entity = this.entity;

      const qb = this.appendWhere(this.conn.deleteFrom(entity.name), where).returning(
         entity.getSelect()
      );

      //await this.emgr.emit(new Mutator.Events.MutatorDeleteBefore({ entity, entityId: id }));

      const res = await this.many(qb);

      /*await this.emgr.emit(
         new Mutator.Events.MutatorDeleteAfter({ entity, entityId: id, data: res.data })
      );*/

      return res;
   }

   async updateWhere(
      data: EntityData,
      where?: RepoQuery["where"]
   ): Promise<MutatorResponse<EntityData>> {
      const entity = this.entity;

      const validatedData = await this.getValidatedData(data, "update");

      /*await this.emgr.emit(
         new Mutator.Events.MutatorUpdateBefore({ entity, entityId: id, data: validatedData })
      );*/

      const query = this.appendWhere(this.conn.updateTable(entity.name), where)
         .set(validatedData)
         //.where(entity.id().name, "=", id)
         .returning(entity.getSelect());

      const res = await this.many(query);

      /*await this.emgr.emit(
         new Mutator.Events.MutatorUpdateAfter({ entity, entityId: id, data: res.data })
      );*/

      return res;
   }
}
