import { objectTransform } from "core/utils";
import { MediaField, mediaFieldConfigSchema } from "../media/MediaField";
import { FieldClassMap } from "data/fields";
import { RelationClassMap, RelationFieldClassMap } from "data/relations";
import { entityConfigSchema, entityTypes } from "data/entities";
import { primaryFieldTypes } from "./fields";
import { s } from "bknd/utils";
import { $object, $record } from "modules/mcp";

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
export const entityFields = s.record(fieldsSchema, { default: {} });
export type TAppDataField = s.Static<typeof fieldsSchema>;
export type TAppDataEntityFields = s.Static<typeof entityFields>;

export const entitiesSchema = s.strictObject({
   name: s.string().optional(), // @todo: verify, old schema wasn't strict (req in UI)
   type: s.string({ enum: entityTypes, default: "regular" }).optional(),
   config: entityConfigSchema.optional(),
   fields: entityFields.optional(),
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

export const dataConfigSchema = $object("config_data", {
   basepath: s.string({ default: "/api/data" }).optional(),
   default_primary_format: s.string({ enum: primaryFieldTypes, default: "integer" }).optional(),
   entities: $record("config_data_entities", entitiesSchema, { default: {} }).optional(),
   relations: $record("config_data_relations", s.anyOf(relationsSchema), {
      default: {},
   }).optional(),
   indices: $record("config_data_indices", indicesSchema, { default: {} }).optional(),
});

export type AppDataConfig = s.Static<typeof dataConfigSchema>;
