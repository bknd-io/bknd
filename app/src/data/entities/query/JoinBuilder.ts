import { ManyToManyRelation, ManyToOneRelation } from "../../relations";
import type { Entity } from "../Entity";
import type { EntityManager } from "../EntityManager";
import type { RepositoryQB } from "./Repository";

export class JoinBuilder {
   private static buildClause(
      em: EntityManager<any>,
      qb: RepositoryQB,
      entity: Entity,
      withString: string,
   ) {
      const relation = em.relationOf(entity.name, withString);
      if (!relation) {
         throw new Error(`Relation "${withString}" not found`);
      }

      return relation.buildJoin(entity, qb, withString);
   }

   // @todo: returns multiple on manytomany (edit: so?)
   static getJoinedEntityNames(em: EntityManager<any>, entity: Entity, joins: string[]): string[] {
      console.log("join", joins);
      return joins.flatMap((join) => {
         const relation = em.relationOf(entity.name, join);
         if (!relation) {
            throw new Error(`Relation "${join}" not found`);
         }

         const other = relation.other(entity);

         if (relation instanceof ManyToOneRelation) {
            return [other.entity.name];
         } else if (relation instanceof ManyToManyRelation) {
            return [other.entity.name, relation.connectionEntity.name];
         }

         return [];
      });
   }

   static addClause(em: EntityManager<any>, qb: RepositoryQB, entity: Entity, joins: string[]) {
      if (joins.length === 0) return qb;

      let newQb = qb;
      for (const entry of joins) {
         newQb = JoinBuilder.buildClause(em, newQb, entity, entry);
      }

      return newQb;
   }
}
