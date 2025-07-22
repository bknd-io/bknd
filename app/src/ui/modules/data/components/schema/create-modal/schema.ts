import { s } from "bknd/utils";
import { entitiesSchema, fieldsSchema, relationsSchema } from "data/data-schema";

export const ModalActions = ["entity", "relation", "media"] as const;

export const entitySchema = s.object({
   ...entitiesSchema.properties,
   name: s.string(),
});

// @todo: this union is not fully working, just "string"
const schemaAction = s.anyOf([
   s.string({ enum: ["entity", "relation", "media"] }),
   s.string({ pattern: "^template-" }),
]);
export type TSchemaAction = s.Static<typeof schemaAction>;

const createFieldSchema = s.object({
   entity: s.string(),
   name: s.string(),
   field: s.array(fieldsSchema),
});
export type TFieldCreate = s.Static<typeof createFieldSchema>;

const createModalSchema = s.strictObject({
   action: schemaAction,
   initial: s.any().optional(),
   entities: s
      .object({
         create: s.array(entitySchema).optional(),
      })
      .optional(),
   relations: s
      .object({
         create: s.array(s.anyOf(relationsSchema)).optional(),
      })
      .optional(),
   fields: s
      .object({
         create: s.array(createFieldSchema).optional(),
      })
      .optional(),
});
export type TCreateModalSchema = s.Static<typeof createModalSchema>;
