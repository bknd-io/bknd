import { type App, type AppPlugin, em, entity, datetime, DatabaseEvents } from "bknd";
import { $console } from "bknd/utils";

export type TimestampsPluginOptions = {
   entities: string[];
   setUpdatedOnCreate?: boolean;
   indexStrategy?: "composite" | "individual";
};

/**
 * This plugin adds `created_at` and `updated_at` fields to the specified entities.
 * Add it to your plugins in `bknd.config.ts` like this:
 *
 * ```ts
 * export default {
 *    plugins: [timestamps({ entities: ["posts"] })],
 * }
 * ```
 */
export function timestamps({
   entities = [],
   setUpdatedOnCreate = true,
   indexStrategy,
}: TimestampsPluginOptions): AppPlugin {
   return (app: App) => ({
      name: "timestamps",
      schema: () => {
         if (entities.length === 0) {
            $console.warn("No entities specified for timestamps plugin");
            return;
         }

         const appEntities = app.em.entities.map((e) => e.name);
         const actualEntities = entities.filter((e) => appEntities.includes(e));

         return em(
            Object.fromEntries(
               actualEntities.map((e) => [
                  e,
                  entity(e, {
                     created_at: datetime(),
                     updated_at: datetime(),
                  }),
               ]),
            ),
            (fns, schema) => {
               if (indexStrategy) {
                  for (const entity of actualEntities) {
                     if (entity in schema) {
                        switch (indexStrategy) {
                           case "composite":
                              fns.index(schema[entity]!).on(["created_at", "updated_at"]);
                              break;
                           case "individual":
                              fns.index(schema[entity]!).on(["created_at"]);
                              fns.index(schema[entity]!).on(["updated_at"]);
                              break;
                        }
                     }
                  }
               }
            },
         );
      },
      onBuilt: async () => {
         app.emgr.onEvent(
            DatabaseEvents.MutatorInsertBefore,
            (event) => {
               const { entity, data } = event.params;
               if (entities.includes(entity.name)) {
                  return {
                     ...data,
                     created_at: new Date(),
                     updated_at: setUpdatedOnCreate ? new Date() : null,
                  };
               }
               return data;
            },
            {
               mode: "sync",
               id: "bknd-timestamps",
            },
         );

         app.emgr.onEvent(
            DatabaseEvents.MutatorUpdateBefore,
            async (event) => {
               const { entity, data } = event.params;
               if (entities.includes(entity.name)) {
                  return {
                     ...data,
                     updated_at: new Date(),
                  };
               }
               return data;
            },
            {
               mode: "sync",
               id: "bknd-timestamps",
            },
         );
      },
   });
}
