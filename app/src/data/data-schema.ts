import { type Static, StringRecord, Type, objectTransform } from "core/utils";
import {
   FieldClassMap,
   RelationClassMap,
   RelationFieldClassMap,
   entityConfigSchema,
   entityTypes,
} from "data";
import { MediaField, mediaFieldConfigSchema } from "../media/MediaField";

export const FIELDS = {
   ...FieldClassMap,
   ...RelationFieldClassMap,
   media: { schema: mediaFieldConfigSchema, field: MediaField },
};
export type FieldType = keyof typeof FIELDS;

export const RELATIONS = RelationClassMap;

export const fieldsSchemaObject = objectTransform(FIELDS, (field, name) => {
   return Type.Object(
      {
         type: Type.Const(name, { default: name, readOnly: true }),
         config: Type.Optional(field.schema),
      },
      {
         title: name,
      },
   );
});
export const fieldsSchema = Type.Union(Object.values(fieldsSchemaObject));
export const entityFields = StringRecord(fieldsSchema);
export type TAppDataField = Static<typeof fieldsSchema>;
export type TAppDataEntityFields = Static<typeof entityFields>;

export const entitiesSchema = Type.Object({
   type: Type.Optional(Type.String({ enum: entityTypes, default: "regular", readOnly: true })),
   config: Type.Optional(entityConfigSchema),
   fields: Type.Optional(entityFields),
});
export type TAppDataEntity = Static<typeof entitiesSchema>;

export const relationsSchema = Object.entries(RelationClassMap).map(([name, relationClass]) => {
   return Type.Object(
      {
         type: Type.Const(name, { default: name, readOnly: true }),
         source: Type.String(),
         target: Type.String(),
         config: Type.Optional(relationClass.schema),
      },
      {
         title: name,
      },
   );
});
export type TAppDataRelation = Static<(typeof relationsSchema)[number]>;

export const indicesSchema = Type.Object(
   {
      entity: Type.String(),
      fields: Type.Array(Type.String(), { minItems: 1 }),
      unique: Type.Optional(Type.Boolean({ default: false })),
   },
   {
      additionalProperties: false,
   },
);

export const dataConfigSchema = Type.Object(
   {
      basepath: Type.Optional(Type.String({ default: "/api/data" })),
      entities: Type.Optional(StringRecord(entitiesSchema, { default: {} })),
      relations: Type.Optional(StringRecord(Type.Union(relationsSchema), { default: {} })),
      indices: Type.Optional(StringRecord(indicesSchema, { default: {} })),
   },
   {
      additionalProperties: false,
   },
);

export type AppDataConfig = Static<typeof dataConfigSchema>;
