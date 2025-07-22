import { constructEntity } from "data/schema/constructor";
import {
   type TAppDataEntity,
   type TAppDataEntityFields,
   type TAppDataField,
   type TAppDataRelation,
   entitiesSchema,
   entityFields,
   fieldsSchema,
   relationsSchema,
} from "data/data-schema";
import { useBknd } from "ui/client/bknd";
import type { TSchemaActions } from "ui/client/schema/actions";
import { bkndModals } from "ui/modals";
import { s, parse, InvalidSchemaError, transformObject } from "bknd/utils";

export function useBkndData() {
   const { config, app, schema, actions: bkndActions } = useBknd();

   // @todo: potentially store in ref, so it doesn't get recomputed? or use memo?
   const entities = transformObject(config.data.entities ?? {}, (entity, name) => {
      return constructEntity(name, entity);
   });

   const actions = {
      entity: {
         add: async (name: string, data: TAppDataEntity) => {
            const validated = parse(entitiesSchema, data, {
               skipMark: true,
               forceParse: true,
            });
            // @todo: check for existing?
            return await bkndActions.add("data", `entities.${name}`, validated);
         },
         patch: (entityName: string) => {
            const entity = entities[entityName];
            if (!entity) {
               throw new Error(`Entity "${entityName}" not found`);
            }

            return {
               config: async (partial: Partial<TAppDataEntity["config"]>): Promise<boolean> => {
                  return await bkndActions.overwrite(
                     "data",
                     `entities.${entityName}.config`,
                     partial,
                  );
               },
               fields: entityFieldActions(bkndActions, entityName),
            };
         },
      },
      relations: {
         add: async (relation: TAppDataRelation) => {
            const name = crypto.randomUUID();
            const validated = parse(s.anyOf(relationsSchema), relation, {
               skipMark: true,
               forceParse: true,
            });
            return await bkndActions.add("data", `relations.${name}`, validated);
         },
      },
   };
   const $data = {
      entity: (name: string) => entities[name],
      modals,
      system: (name: string) => ({
         any: entities[name]?.type === "system",
         users: name === config.auth.entity_name,
         media: name === config.media.entity_name,
      }),
   };

   return {
      $data,
      entities,
      relations: app.relations,
      config: config.data,
      schema: schema.data,
      actions,
   };
}

const modals = {
   createAny: () => bkndModals.open(bkndModals.ids.dataCreate, {}),
   createEntity: () =>
      bkndModals.open(bkndModals.ids.dataCreate, {
         initialPath: ["entities", "entity"],
         initialState: { action: "entity" },
      }),
   createRelation: (entity?: string) =>
      bkndModals.open(bkndModals.ids.dataCreate, {
         initialPath: ["entities", "relation"],
         initialState: {
            action: "relation",
            relations: {
               create: [{ source: entity, type: "n:1" } as any],
            },
         },
      }),
   createMedia: (entity?: string) =>
      bkndModals.open(bkndModals.ids.dataCreate, {
         initialPath: ["entities", "template-media"],
         initialState: {
            action: "template-media",
            initial: {
               entity,
            },
         },
      }),
};

function entityFieldActions(bkndActions: TSchemaActions, entityName: string) {
   return {
      add: async (name: string, field: TAppDataField) => {
         const validated = parse(fieldsSchema, field, {
            skipMark: true,
            forceParse: true,
         });
         return await bkndActions.add("data", `entities.${entityName}.fields.${name}`, validated);
      },
      patch: () => null,
      set: async (fields: TAppDataEntityFields) => {
         try {
            const validated = parse(entityFields, fields, {
               skipMark: true,
               forceParse: true,
            });
            const res = await bkndActions.overwrite(
               "data",
               `entities.${entityName}.fields`,
               validated,
            );
         } catch (e) {
            console.error("error", e);
            if (e instanceof InvalidSchemaError) {
               alert("Error updating fields: " + e.firstToString());
            } else {
               alert("An error occured, check console. There will be nice error handling soon.");
            }
         }
      },
   };
}
