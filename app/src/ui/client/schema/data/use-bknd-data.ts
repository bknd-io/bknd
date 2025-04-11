import { TypeInvalidError, parse, transformObject } from "core/utils";
import { constructEntity } from "data";
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
import * as tb from "@sinclair/typebox";
const { Type } = tb;

export function useBkndData() {
   const { config, app, schema, actions: bkndActions } = useBknd();

   // @todo: potentially store in ref, so it doesn't get recomputed? or use memo?
   const entities = transformObject(config.data.entities ?? {}, (entity, name) => {
      return constructEntity(name, entity);
   });

   const actions = {
      entity: {
         add: async (name: string, data: TAppDataEntity) => {
            console.log("create entity", { data });
            const validated = parse(entitiesSchema, data, {
               skipMark: true,
               forceParse: true,
            });
            console.log("validated", validated);
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
                  console.log("patch config", entityName, partial);
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
            console.log("create relation", { relation });
            const name = crypto.randomUUID();
            const validated = parse(Type.Union(relationsSchema), relation, {
               skipMark: true,
               forceParse: true,
            });
            console.log("validated", validated);
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
         console.log("create field", { name, field });
         const validated = parse(fieldsSchema, field, {
            skipMark: true,
            forceParse: true,
         });
         console.log("validated", validated);
         return await bkndActions.add("data", `entities.${entityName}.fields.${name}`, validated);
      },
      patch: () => null,
      set: async (fields: TAppDataEntityFields) => {
         console.log("set fields", entityName, fields);
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
            console.log("res", res);
            //bkndActions.set("data", "entities", fields);
         } catch (e) {
            console.error("error", e);
            if (e instanceof TypeInvalidError) {
               alert("Error updating fields: " + e.firstToString());
            } else {
               alert("An error occured, check console. There will be nice error handling soon.");
            }
         }
      },
   };
}
