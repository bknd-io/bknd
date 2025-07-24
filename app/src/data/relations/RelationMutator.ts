import type { PrimaryFieldType } from "core";
import type { Entity, EntityManager } from "../entities";
import {
   type EntityRelation,
   ManyToManyRelation,
   type MutationOperation,
   MutationOperations,
   RelationField,
} from "../relations";

export type MutationInstructionResponse = [string, PrimaryFieldType | null];

export class RelationMutator {
   constructor(
      protected entity: Entity,
      protected em: EntityManager<any>,
   ) {}

   /**
    * Returns all keys that are somehow relational.
    * Includes local fields (users_id) and references (users|author)
    *
    * @param em
    * @param entity_name
    *
    * @returns string[]
    */
   getRelationalKeys(): string[] {
      const references: string[] = [];

      // if persisting a manytomany connection table
      // @todo: improve later
      if (this.entity.type === "generated") {
         const relation = this.em.relations.all.find(
            (r) => r instanceof ManyToManyRelation && r.connectionEntity.name === this.entity.name,
         );
         if (relation instanceof ManyToManyRelation) {
            references.push(
               ...this.entity.fields.filter((f) => f.type === "relation").map((f) => f.name),
            );
         }
      }

      this.em.relationsOf(this.entity.name).map((r) => {
         const info = r.helper(this.entity.name).getMutationInfo();
         references.push(info.reference);
         info.local_field && references.push(info.local_field);
      });

      return references;
   }

   async persistRelationField(
      field: RelationField,
      key: string,
      value: PrimaryFieldType,
   ): Promise<MutationInstructionResponse> {
      // allow empty if field is not required
      if (value === null && !field.isRequired()) {
         return [key, value];
      }

      // make sure it's a primitive value
      // @todo: this is not a good way of checking primitives. Null is also an object
      if (typeof value === "object") {
         throw new Error(`Invalid value for relation field "${key}" given, expected primitive.`);
      }

      const query = await this.em.repository(field.target()).exists({
         [field.targetField()]: value,
      });

      if (!query.data.exists) {
         const idProp = field.targetField();
         throw new Error(
            `Cannot connect "${this.entity.name}.${key}" to ` +
               `"${field.target()}.${idProp}" = "${value}": not found.`,
         );
      }

      return [key, value];
   }

   async persistReference(
      relation: EntityRelation,
      key: string,
      value: unknown,
   ): Promise<void | MutationInstructionResponse> {
      if (typeof value !== "object" || value === null || typeof value === "undefined") {
         throw new Error(
            `Invalid value for relation "${key}" given, expected object to persist reference. Like '{$set: {id: 1}}'.`,
         );
      }

      const operation = Object.keys(value)[0] as MutationOperation;
      if (!MutationOperations.includes(operation)) {
         throw new Error(
            `Invalid operation "${operation}" for relation "${key}". ` +
               `Allowed: ${MutationOperations.join(", ")}`,
         );
      }

      // @ts-ignore
      const payload = value[operation];
      return await relation[operation](this.em, key, payload);
   }

   async persistRelation(key: string, value: unknown): Promise<void | MutationInstructionResponse> {
      // if field (e.g. 'user_id')
      // relation types: n:1, 1:1 (mapping entity)
      const field = this.entity.getField(key);
      if (field instanceof RelationField) {
         return this.persistRelationField(field, key, value as PrimaryFieldType);
      }

      /**
       * If reference given, value operations are given
       *
       * Could be:
       * { $set: { id: 1 } }
       * { $set: [{ id: 1 }, { id: 2 }] }
       * { $create: { theme: "dark" } }
       * { $attach: [{ id: 1 }, { id: 2 }] }
       * { $detach: [{ id: 1 }, { id: 2 }] }
       */
      const relation = this.em.relationOf(this.entity.name, key);
      if (relation) {
         return this.persistReference(relation, key, value);
      }

      throw new Error(
         `Relation "${key}" failed to resolve on entity "${this.entity.name}": ` +
            "Unable to resolve relation origin.",
      );
   }
}
