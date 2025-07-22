import { objectTransform } from "core/utils";
import { MediaField, mediaFieldConfigSchema } from "../media/MediaField";
import { FieldClassMap } from "data/fields";
import { RelationClassMap, RelationFieldClassMap } from "data/relations";
import { entityConfigSchema, entityTypes } from "data/entities";
import { primaryFieldTypes } from "./fields";
import { s } from "bknd/utils";

export const FIELDS = {
   ...FieldClassMap,
   ...RelationFieldClassMap,
   media: { schema: mediaFieldConfigSchema, field: MediaField },
};
export type FieldType = keyof typeof FIELDS;

export const RELATIONS = RelationClassMap;

export const fieldsSchemaObject = objectTransform(FIELDS, (field, name) => {
   return s.strictObject(
      {
         name: s.string().optional(), // @todo: verify, old schema wasn't strict (req in UI)
         type: s.literal(name),
         config: field.schema.optional(),
      },
      {
         title: name,
      },
   );
});
export const fieldsSchema = s.anyOf(Object.values(fieldsSchemaObject));
export const entityFields = s.record(fieldsSchema);
export type TAppDataField = s.Static<typeof fieldsSchema>;
export type TAppDataEntityFields = s.Static<typeof entityFields>;

export const entitiesSchema = s.strictObject({
   name: s.string().optional(), // @todo: verify, old schema wasn't strict (req in UI)
   type: s.string({ enum: entityTypes, default: "regular" }),
   config: entityConfigSchema,
   fields: entityFields,
});
export type TAppDataEntity = s.Static<typeof entitiesSchema>;

export const relationsSchema = Object.entries(RelationClassMap).map(([name, relationClass]) => {
   return s.strictObject(
      {
         type: s.literal(name),
         source: s.string(),
         target: s.string(),
         config: relationClass.schema.optional(),
      },
      {
         title: name,
      },
   );
});
export type TAppDataRelation = s.Static<(typeof relationsSchema)[number]>;

export const indicesSchema = s.strictObject({
   entity: s.string(),
   fields: s.array(s.string(), { minItems: 1 }),
   unique: s.boolean({ default: false }).optional(),
});

export const dataConfigSchema = s.strictObject({
   basepath: s.string({ default: "/api/data" }).optional(),
   default_primary_format: s.string({ enum: primaryFieldTypes, default: "integer" }).optional(),
   entities: s.record(entitiesSchema, { default: {} }).optional(),
   relations: s.record(s.anyOf(relationsSchema), { default: {} }).optional(),
   indices: s.record(indicesSchema, { default: {} }).optional(),
});

export type AppDataConfig = s.Static<typeof dataConfigSchema>;
