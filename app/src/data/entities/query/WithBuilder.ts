import { isObject } from "core/utils";

import type { KyselyJsonFrom } from "data/relations/EntityRelation";
import type { RepoQuery } from "data/server/query";
import { InvalidSearchParamsException } from "data/errors";
import type { Entity, EntityManager, RepositoryQB } from "data/entities";

export class WithBuilder {
   static addClause(
      em: EntityManager<any>,
      qb: RepositoryQB,
      entity: Entity,
      withs: RepoQuery["with"],
   ) {
      if (!withs || !isObject(withs)) {
         console.warn(`'withs' undefined or invalid, given: ${JSON.stringify(withs)}`);
         return qb;
      }

      const fns = em.connection.fn;
      let newQb = qb;

      for (const [ref, query] of Object.entries(withs)) {
         const relation = em.relationOf(entity.name, ref);
         if (!relation) {
            throw new Error(`Relation "${entity.name}<>${ref}" not found`);
         }
         const cardinality = relation.ref(ref).cardinality;
         const jsonFrom: KyselyJsonFrom =
            cardinality === 1 ? fns.jsonObjectFrom : fns.jsonArrayFrom;
         if (!jsonFrom) {
            throw new Error("Connection does not support jsonObjectFrom/jsonArrayFrom");
         }

         const other = relation.other(entity);
         newQb = newQb.select((eb) => {
            let subQuery = relation.buildWith(entity, ref)(eb);
            if (query) {
               subQuery = em.repo(other.entity).addOptionsToQueryBuilder(subQuery, query as any, {
                  ignore: ["with", "join", cardinality === 1 ? "limit" : undefined].filter(
                     Boolean,
                  ) as any,
               });
            }

            if (query.with) {
               subQuery = WithBuilder.addClause(em, subQuery, other.entity, query.with as any);
            }

            return jsonFrom(subQuery).as(other.reference);
         });
      }

      return newQb;
   }

   static validateWiths(em: EntityManager<any>, entity: string, withs: RepoQuery["with"]) {
      let depth = 0;
      if (!withs || !isObject(withs)) {
         withs && console.warn(`'withs' invalid, given: ${JSON.stringify(withs)}`);
         return depth;
      }

      const child_depths: number[] = [];
      for (const [ref, query] of Object.entries(withs)) {
         const related = em.relationOf(entity, ref);
         if (!related) {
            throw new InvalidSearchParamsException(
               `WITH: "${ref}" is not a relation of "${entity}"`,
            );
         }
         depth++;

         if ("with" in query) {
            child_depths.push(WithBuilder.validateWiths(em, ref, query.with as any));
         }
      }
      if (child_depths.length > 0) {
         depth += Math.max(...child_depths);
      }

      return depth;
   }
}
