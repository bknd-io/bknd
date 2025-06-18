import { $console } from "core/console";
import type { Entity, EntityData } from "../Entity";
import type { EntityManager } from "../EntityManager";
import { Result, type ResultJSON, type ResultOptions } from "../Result";
import { isDebug } from "core";

export type MutatorResultOptions = ResultOptions & {
   silent?: boolean;
   logParams?: boolean;
};

export type MutatorResultJSON<T = EntityData[]> = ResultJSON<T>;

export class MutatorResult<T = EntityData[]> extends Result<T> {
   constructor(
      protected em: EntityManager<any>,
      public entity: Entity,
      options?: MutatorResultOptions,
   ) {
      const logParams = options?.logParams === undefined ? isDebug() : options.logParams;

      super(em.connection, {
         hydrator: (rows) => em.hydrate(entity.name, rows as any),
         beforeExecute: (compiled) => {
            if (!options?.silent) {
               $console.debug(
                  `[Mutation]\n${compiled.sql}\n`,
                  logParams ? compiled.parameters : undefined,
               );
            }
         },
         onError: (error) => {
            if (!options?.silent) {
               $console.error("[ERROR] Mutator:", error.message);
            }
         },
         ...options,
      });
   }
}
