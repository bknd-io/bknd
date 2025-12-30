import type { Entity, EntityManager } from "../entities";
import { ManyToOneRelation, type ManyToOneRelationConfig } from "./ManyToOneRelation";
import type { MutationInstructionResponse } from "./RelationMutator";
import { type RelationType, RelationTypes } from "./relation-types";

/**
 * Both source and target receive a mapping field
 * Source gets the mapping field, and can $create the target
 * @todo: determine if it should be removed
 */
export type OneToOneRelationConfig = ManyToOneRelationConfig;

export class OneToOneRelation extends ManyToOneRelation {
   constructor(source: Entity, target: Entity, config?: OneToOneRelationConfig) {
      const { mappedBy, inversedBy, required } = config || {};
      super(source, target, {
         mappedBy,
         inversedBy,
         sourceCardinality: 1,
         required,
         with_limit: 1,
      });
   }

   override type(): RelationType {
      return RelationTypes.OneToOne;
   }

   /**
    * One-to-one relations are not listable in either direction
    */
   override isListableFor(): boolean {
      return false;
   }

   // need to override since it inherits manytoone
   override async $set(
      em: EntityManager<any>,
      key: string,
      value: object,
   ): Promise<MutationInstructionResponse> {
      throw new Error("$set is not allowed");
   }

   override async $create(
      em: EntityManager<any>,
      key: string,
      value: unknown,
   ): Promise<void | MutationInstructionResponse> {
      if (value === null || typeof value !== "object") {
         throw new Error(`Invalid value for relation field "${key}" given, expected object.`);
      }

      const target = this.other(this.source.entity).entity;
      const helper = this.helper(this.source.entity.name);
      const info = helper.getMutationInfo();
      const primary = info.primary;
      const local_field = info.local_field;
      if (!info.$create || !primary || !local_field) {
         throw new Error(`Cannot perform $create for relation "${key}"`);
      }

      // create the relational entity
      try {
         const { data } = await em.mutator(target).insertOne(value);

         const retrieved_value = data[primary];
         return [local_field, retrieved_value] satisfies MutationInstructionResponse;
      } catch (e) {
         throw new Error(`Error performing $create on "${target.name}".`);
      }
   }
}
