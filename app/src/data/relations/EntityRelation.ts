import { type Static, parse } from "core/utils";
import type { ExpressionBuilder, SelectQueryBuilder } from "kysely";
import type { Entity, EntityData, EntityManager } from "../entities";
import {
   type EntityRelationAnchor,
   type MutationInstructionResponse,
   RelationHelper,
} from "../relations";
import type { RepoQuery } from "../server/data-query-impl";
import type { RelationType } from "./relation-types";
import * as tbbox from "@sinclair/typebox";
const { Type } = tbbox;

const directions = ["source", "target"] as const;
export type TDirection = (typeof directions)[number];

export type KyselyJsonFrom = any;
export type KyselyQueryBuilder = SelectQueryBuilder<any, any, any>;

export type BaseRelationConfig = Static<typeof EntityRelation.schema>;

// @todo: add generic type for relation config
export abstract class EntityRelation<
   Schema extends typeof EntityRelation.schema = typeof EntityRelation.schema,
> {
   config: Static<Schema>;

   source: EntityRelationAnchor;
   target: EntityRelationAnchor;

   // @todo: add unit tests
   // allowed directions, used in RelationAccessor for visibility
   directions: TDirection[] = ["source", "target"];

   static schema = Type.Object({
      mappedBy: Type.Optional(Type.String()),
      inversedBy: Type.Optional(Type.String()),
      required: Type.Optional(Type.Boolean()),
   });

   // don't make protected, App requires it to instantiatable
   constructor(
      source: EntityRelationAnchor,
      target: EntityRelationAnchor,
      config: Partial<Static<Schema>> = {},
   ) {
      this.source = source;
      this.target = target;

      const schema = (this.constructor as typeof EntityRelation).schema;
      // @ts-ignore for now
      this.config = parse(schema, config);
   }

   abstract initialize(em: EntityManager<any>): void;

   /**
    * Build the "with" part of the query.
    *
    * @param entity requesting entity, so target needs to be added
    * @param qb
    * @param jsonFrom
    */
   abstract buildWith(
      entity: Entity,
      reference: string,
   ): (eb: ExpressionBuilder<any, any>) => KyselyQueryBuilder;

   abstract buildJoin(
      entity: Entity,
      qb: KyselyQueryBuilder,
      reference: string,
   ): KyselyQueryBuilder;

   getReferenceQuery(entity: Entity, id: number, reference: string): Partial<RepoQuery> {
      return {};
   }

   /** @deprecated */
   helper(entity_name: string): RelationHelper {
      return new RelationHelper(this, entity_name);
   }

   /**
    * Get the other side of the relation quickly
    * @param entity
    */
   other(entity: Entity | string): EntityRelationAnchor {
      const entity_name = typeof entity === "string" ? entity : entity.name;

      // special case for self referencing, check which side is not cardinality 1
      if (this.source.entity.name === this.target.entity.name) {
         return this.source.cardinality === 1 ? this.target : this.source;
      }

      if (this.source.entity.name === entity_name) {
         return this.target;
      } else if (this.target.entity.name === entity_name) {
         return this.source;
      }

      throw new Error(
         `Entity "${entity_name}" is not part of the relation ` +
            `"${this.source.entity.name} <-> ${this.target.entity.name}"`,
      );
   }

   self(entity: Entity | string): EntityRelationAnchor {
      return this.other(entity).entity.name === this.source.entity.name ? this.target : this.source;
   }

   ref(reference: string): EntityRelationAnchor {
      return this.source.reference === reference ? this.source : this.target;
   }

   otherRef(reference: string): EntityRelationAnchor {
      return this.source.reference === reference ? this.target : this.source;
   }

   // @todo: add unit tests
   visibleFrom(from: "source" | "target"): boolean {
      return this.directions.includes(from);
   }

   /**
    * Hydrate the relation. "entity" represents where the payload belongs to.
    * E.g. if entity is "categories", then value is the result of categories
    *
    * IMPORTANT: This method is called from EM, high potential of recursion!
    *
    * @param entity
    * @param value
    * @param em
    */
   hydrate(entity: Entity | string, value: EntityData[], em: EntityManager<any>) {
      const entity_name = typeof entity === "string" ? entity : entity.name;
      const anchor = this.ref(entity_name);
      const hydrated = em.hydrate(anchor.entity.name, value);

      if (anchor.cardinality === 1) {
         if (Array.isArray(hydrated) && hydrated.length > 1) {
            throw new Error(
               `Failed to hydrate "${anchor.entity.name}" ` +
                  `with value: ${JSON.stringify(value)} (cardinality: 1)`,
            );
         }

         return hydrated[0];
      }

      if (!hydrated) {
         throw new Error(
            `Failed to hydrate "${anchor.entity.name}" ` +
               `with value: ${JSON.stringify(value)} (cardinality: -)`,
         );
      }

      return hydrated;
   }

   /**
    * Determines if the relation is listable for the given entity
    * If the given entity is the one with the local reference, then it's not listable
    * Only if there are multiple, which is generally the other side (except for 1:1)
    * @param entity
    */
   isListableFor(entity: Entity): boolean {
      return this.target.entity.name === entity.name;
   }

   abstract type(): RelationType;

   get required(): boolean {
      return !!this.config.required;
   }

   async $set(
      em: EntityManager<any>,
      key: string,
      value: unknown,
   ): Promise<void | MutationInstructionResponse> {
      throw new Error("$set is not allowed");
   }

   async $create(
      em: EntityManager<any>,
      key: string,
      value: unknown,
   ): Promise<void | MutationInstructionResponse> {
      throw new Error("$create is not allowed");
   }

   async $attach(
      em: EntityManager<any>,
      key: string,
      value: unknown,
   ): Promise<void | MutationInstructionResponse> {
      throw new Error("$attach is not allowed");
   }

   async $detach(
      em: EntityManager<any>,
      key: string,
      value: unknown,
   ): Promise<void | MutationInstructionResponse> {
      throw new Error("$detach is not allowed");
   }

   getName(): string {
      const parts = [
         this.type().replace(":", ""),
         this.source.entity.name,
         this.target.entity.name,
         this.config.mappedBy,
         this.config.inversedBy,
      ].filter(Boolean);
      return parts.join("_");
   }

   toJSON() {
      return {
         type: this.type(),
         source: this.source.entity.name,
         target: this.target.entity.name,
         config: this.config,
      };
   }
}
