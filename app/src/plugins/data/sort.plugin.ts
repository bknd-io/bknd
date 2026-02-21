import { Exception, type App, type AppPlugin, DatabaseEvents, em, entity, number } from "bknd";
import { invariant, HttpStatus, jsc, s, $console } from "bknd/utils";
import { Hono } from "hono";
import { sql } from "kysely";

const DEFAULT_BATCH_SIZE = 1000;

export type SortPluginOptions = {
   /**
    * The base path for the API endpoints.
    * @default "/api/sort"
    */
   apiBasePath?: string;

   /**
    * Configuration for entities that should have sorting enabled.
    * Key is the entity name, value is the configuration.
    */
   entities: Record<
      string,
      {
         /**
          * The name of the sort property (must be a number field).
          */
         field: string;

         /**
          * Optional scope field name. If provided, sorting will only happen within the same scope.
          * For example, if scope is "category_id", items will only be sorted within items
          * that have the same category_id value.
          */
         scope?: string;
      }
   >;

   /**
    * The batch size for recalculating sort order.
    * @default 1000
    */
   recalculateBatchSize?: number;
};

class SortError extends Exception {
   override name = "SortError";
   override code = HttpStatus.BAD_REQUEST;
}

export function sort({
   apiBasePath = "/api/sort",
   entities,
   recalculateBatchSize = DEFAULT_BATCH_SIZE,
}: SortPluginOptions): AppPlugin {
   return (app: App) => {
      return {
         name: "sort",
         schema: () => {
            return em(
               Object.fromEntries(
                  Object.entries(entities).map(([entityName, config]) => [
                     entityName,
                     entity(entityName, {
                        [config.field]: number({ default_value: 0 }),
                     }),
                  ]),
               ),
               ({ index }, schema) => {
                  for (const [entityName, config] of Object.entries(entities)) {
                     const indexed = app.em.getIndexedFields(entityName);
                     if (!indexed.some((f) => f.name === config.field)) {
                        index(schema[entityName]!).on([config.field]);
                     }
                  }
               },
            );
         },
         onBuilt: async () => {
            invariant(
               entities && Object.keys(entities).length > 0,
               "At least one entity must be configured",
            );

            // validate entities exist and have the configured fields
            for (const [entityName, config] of Object.entries(entities)) {
               const entity = app.em.entity(entityName);
               invariant(entity, `Entity "${entityName}" not found in schema`);

               const sortFieldSchema = entity.field(config.field)!;
               invariant(
                  sortFieldSchema,
                  `Sort field "${config.field}" not found in entity "${entityName}"`,
               );
               invariant(
                  sortFieldSchema.type === "number",
                  `Sort field "${config.field}" in entity "${entityName}" must be a number field`,
               );

               if (config.scope) {
                  const scopeFieldSchema = entity.field(config.scope);
                  invariant(
                     scopeFieldSchema,
                     `Scope field "${config.scope}" not found in entity "${entityName}"`,
                  );
               }
            }

            const hono = new Hono();

            // register recalculate endpoints for each entity
            for (const [entityName, config] of Object.entries(entities)) {
               hono.post(
                  `/${entityName}/recalculate`,
                  jsc(
                     "json",
                     s
                        .object({
                           scope: s.any().optional(),
                        })
                        .optional(),
                  ),
                  async (c) => {
                     const body = c.req.valid("json");
                     const scope = body?.scope;

                     await recalculateSortOrder(
                        app,
                        entityName,
                        config,
                        recalculateBatchSize,
                        scope,
                     );

                     return c.json({ success: true, message: "Sort order recalculated" });
                  },
               );

               hono.post(
                  `/${entityName}/reorder`,
                  jsc(
                     "json",
                     s.object({
                        id: s.any(),
                        position: s.number(),
                     }),
                  ),
                  async (c) => {
                     const { id, position } = c.req.valid("json");

                     await reorderItem(app, entityName, config, id, position);

                     return c.json({ success: true, message: "Item reordered" });
                  },
               );
            }

            app.server.route(apiBasePath, hono);

            // register listeners for automatic reordering
            registerListeners(app, entities);
         },
      };
   };
}

async function reorderItem(
   app: App,
   entityName: string,
   config: SortPluginOptions["entities"][string],
   id: any,
   newPosition: number,
) {
   const { field: sortField, scope: scopeField } = config;
   const em = app.em.fork();
   const kysely = em.connection.kysely;

   // get the item
   const { data: item } = await em.repo(entityName).findOne({ id });
   if (!item) {
      throw new SortError(`Item with id "${id}" not found in entity "${entityName}"`);
   }

   const oldPosition = item[sortField] as number | null | undefined;
   const scopeValue = scopeField ? item[scopeField] : undefined;

   // update the item with new position (using forked em, so no listeners are triggered)
   await em.mutator(entityName).updateOne(id, { [sortField]: newPosition });

   // shift other items using kysely
   if (oldPosition !== undefined && oldPosition !== null && oldPosition !== newPosition) {
      if (newPosition < oldPosition) {
         // moving up: increment items between newPosition and oldPosition
         let query = kysely
            .updateTable(entityName)
            .set({ [sortField]: sql`${sql.ref(sortField)} + 1` } as any)
            .where(sortField as any, ">=", newPosition)
            .where(sortField as any, "<", oldPosition)
            .where("id", "!=", id);

         if (scopeField && scopeValue !== undefined) {
            query = query.where(scopeField as any, "=", scopeValue);
         }

         await query.execute();
      } else {
         // moving down: decrement items between oldPosition and newPosition
         let query = kysely
            .updateTable(entityName)
            .set({ [sortField]: sql`${sql.ref(sortField)} - 1` } as any)
            .where(sortField as any, ">", oldPosition)
            .where(sortField as any, "<=", newPosition)
            .where("id", "!=", id);

         if (scopeField && scopeValue !== undefined) {
            query = query.where(scopeField as any, "=", scopeValue);
         }

         await query.execute();
      }
   } else if (oldPosition === undefined || oldPosition === null) {
      // new item, shift everything at or after this position
      let query = kysely
         .updateTable(entityName)
         .set({ [sortField]: sql`${sql.ref(sortField)} + 1` } as any)
         .where(sortField as any, ">=", newPosition)
         .where("id", "!=", id);

      if (scopeField && scopeValue !== undefined) {
         query = query.where(scopeField as any, "=", scopeValue);
      }

      await query.execute();
   }
}

async function recalculateSortOrder(
   app: App,
   entityName: string,
   config: SortPluginOptions["entities"][string],
   batchSize: number,
   scope?: any,
) {
   const { field: sortField, scope: scopeField } = config;
   const db = app.connection.kysely;

   const { count } = (await db
      .selectFrom(entityName)
      .select((eb) => eb.fn.count<number>("id").as("count"))
      .$if(Boolean(scopeField && scope !== undefined), (eb) =>
         eb.where(scopeField as any, "=", scope),
      )
      .$castTo<{ count: number }>()
      .executeTakeFirst()) ?? { count: 0 };

   const batches = Math.ceil(count / batchSize);
   for (let i = 0; i < batches; i++) {
      // get all items in scope, ordered by current sort value
      const items = await db
         .selectFrom(entityName)
         .select(["id", sortField])
         .$if(Boolean(scopeField && scope !== undefined), (eb) =>
            eb.where(scopeField as any, "=", scope),
         )
         .orderBy(sortField, "asc")
         .limit(batchSize)
         .offset(i * batchSize)
         .execute();

      const newQbs = items.map((item, index) =>
         db
            .updateTable(entityName)
            .set({ [sortField]: index })
            .where("id", "=", item.id),
      );

      await app.connection.executeQueries(...newQbs);
      $console.log(
         `[Sort Plugin] Recalculated sort order for ${items.length} items in entity "${entityName}"${scopeField && scope !== undefined ? ` (scope: ${scope})` : ""} [batch ${i + 1}/${batches}]`,
      );
   }
}

function registerListeners(app: App, entities: SortPluginOptions["entities"]) {
   const kysely = app.connection.kysely;

   // handle insert events
   app.emgr.onEvent(
      DatabaseEvents.MutatorInsertBefore,
      async (e) => {
         const entityName = e.params.entity.name;
         const config = entities[entityName];
         if (!config) return e.params.data;

         const { field: sortField, scope: scopeField } = config;
         const data = e.params.data;
         const scopeValue = scopeField ? data[scopeField] : undefined;

         // if no position provided, set to max + 1
         if (data[sortField] === undefined || data[sortField] === null) {
            const query = kysely
               .selectFrom(entityName)
               .select((eb) => [eb.fn.max<number>(eb.ref(sortField)).as("max")])
               // add scope filter if needed
               .$if(Boolean(scopeField && scopeValue), (eb) =>
                  eb.where(scopeField as any, "=", scopeValue as any),
               );

            const result = await query.executeTakeFirst();
            const max = result?.max ?? -1;

            return {
               ...data,
               [sortField]: max + 1,
            };
         }

         // if position is provided, shift other items at or after that position
         const newPosition = data[sortField] as number;

         let shiftQuery = kysely
            .updateTable(entityName)
            .set({ [sortField]: sql`${sql.ref(sortField)} + 1` } as any)
            .where(sortField as any, ">=", newPosition);

         if (scopeField && scopeValue !== undefined) {
            shiftQuery = shiftQuery.where(scopeField as any, "=", scopeValue);
         }

         await shiftQuery.execute();

         return data;
      },
      {
         mode: "sync",
         id: "bknd-sort-insert",
      },
   );

   // handle update events
   app.emgr.onEvent(
      DatabaseEvents.MutatorUpdateBefore,
      async (e) => {
         const entityName = e.params.entity.name;
         const config = entities[entityName];
         if (!config) return e.params.data;

         const { field: sortField, scope: scopeField } = config;
         const data = e.params.data;

         // only handle if sort field is being updated
         if (!(sortField in data)) return e.params.data;

         const newPosition = data[sortField] as number;
         const id = e.params.entityId;

         // get the current item to know its old position and scope
         const item = await kysely
            .selectFrom(entityName)
            .selectAll()
            .where("id" as any, "=", id)
            .executeTakeFirst();

         if (!item) return data;

         const oldPosition = item[sortField] as number | null | undefined;
         const scopeValue = scopeField ? item[scopeField] : undefined;

         // if oldPosition is null or undefined, treat as inserting at newPosition
         if (oldPosition === null || oldPosition === undefined) {
            // shift items at or after the new position
            let query = kysely
               .updateTable(entityName)
               .set({ [sortField]: sql`${sql.ref(sortField)} + 1` } as any)
               .where(sortField as any, ">=", newPosition)
               .where("id" as any, "!=", id);

            if (scopeField && scopeValue !== undefined) {
               query = query.where(scopeField as any, "=", scopeValue);
            }

            await query.execute();
            return data;
         }

         // shift other items using kysely
         if (oldPosition !== newPosition) {
            if (newPosition < oldPosition) {
               // moving up: increment items between newPosition and oldPosition
               let query = kysely
                  .updateTable(entityName)
                  .set({ [sortField]: sql`${sql.ref(sortField)} + 1` } as any)
                  .where(sortField as any, ">=", newPosition)
                  .where(sortField as any, "<", oldPosition)
                  .where("id" as any, "!=", id);

               if (scopeField && scopeValue !== undefined) {
                  query = query.where(scopeField as any, "=", scopeValue);
               }

               await query.execute();
            } else {
               // moving down: decrement items between oldPosition and newPosition
               let query = kysely
                  .updateTable(entityName)
                  .set({ [sortField]: sql`${sql.ref(sortField)} - 1` } as any)
                  .where(sortField as any, ">", oldPosition)
                  .where(sortField as any, "<=", newPosition)
                  .where("id" as any, "!=", id);

               if (scopeField && scopeValue !== undefined) {
                  query = query.where(scopeField as any, "=", scopeValue);
               }

               await query.execute();
            }
         }

         return data;
      },
      {
         mode: "sync",
         id: "bknd-sort-update",
      },
   );
}
