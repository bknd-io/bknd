import type { Entity } from "../entities";
import type { EntityRelation } from "../relations";

export class RelationAccessor {
   private readonly _relations: EntityRelation[] = [];

   constructor(relations: EntityRelation[]) {
      this._relations = relations;
   }

   get all(): EntityRelation[] {
      return this._relations;
   }

   exists(relation: EntityRelation): boolean {
      return this._relations.some(
         (r) =>
            r.source.entity.name === relation.source.entity.name &&
            r.target.entity.name === relation.target.entity.name &&
            r.type === relation.type,
      );
   }

   /**
    * Searches for the relations of [entity_name]
    */
   relationsOf(entity: Entity): EntityRelation[] {
      return this._relations.filter((relation) => {
         return (
            (relation.visibleFrom("source") && relation.source.entity.name === entity.name) ||
            (relation.visibleFrom("target") && relation.target.entity.name === entity.name)
         );
      });
   }

   sourceRelationsOf(entity: Entity): EntityRelation[] {
      return this._relations.filter((relation) => {
         return relation.source.entity.name === entity.name;
      });
   }

   /**
    * Search for relations that have [entity] as target
    * - meaning it returns entities that holds a local reference field
    */
   targetRelationsOf(entity: Entity): EntityRelation[] {
      return this._relations.filter((relation) => {
         return relation.visibleFrom("target") && relation.target.entity.name === entity.name;
      });
   }

   listableRelationsOf(entity: Entity): EntityRelation[] {
      return this.relationsOf(entity).filter((relation) => relation.isListableFor(entity));
   }

   /**
    * Searches for the relations of [entity_name] and
    * return the one that has [reference] as source or target.
    */
   relationOf(entity: Entity, reference: string): EntityRelation | undefined {
      return this.relationsOf(entity).find((r) => {
         return (
            (r.target.entity.name === entity.name && r.source.reference === reference) ||
            (r.source.entity.name === entity.name && r.target.reference === reference)
         );
      });
   }

   hasRelations(entity: Entity): boolean {
      return this.relationsOf(entity).length > 0;
   }

   /**
    * Get a list of related entities of [entity_name]
    */
   relatedEntitiesOf(entity: Entity): Entity[] {
      return this.relationsOf(entity).map((r) => r.other(entity).entity);
   }

   /**
    * Get relation names of [entity_name]
    */
   relationReferencesOf(entity): string[] {
      return this.relationsOf(entity).map((r) => r.other(entity).reference);
   }
}
