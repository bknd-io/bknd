import { type Static, StringEnum, StringRecord, objectTransform } from "core/utils";
import * as tb from "@sinclair/typebox";
import {
   FieldClassMap,
   RelationClassMap,
   RelationFieldClassMap,
   entityConfigSchema,
   entityTypes,
} from "data";
import { MediaField, mediaFieldConfigSchema } from "../media/MediaField";
import { primaryFieldTypes } from "./fields";

export const FIELDS = {
   ...FieldClassMap,
   ...RelationFieldClassMap,
   media: { schema: mediaFieldConfigSchema, field: MediaField },
};
export type FieldType = keyof typeof FIELDS;

export const RELATIONS = RelationClassMap;

export const fieldsSchemaObject = objectTransform(FIELDS, (field, name) => {
   return tb.Type.Object(
      {
         type: tb.Type.Const(name, { default: name, readOnly: true }),
         config: tb.Type.Optional(field.schema),
      },
      {
         title: name,
      },
   );
});
export const fieldsSchema = tb.Type.Union(Object.values(fieldsSchemaObject));
export const entityFields = StringRecord(fieldsSchema);
export type TAppDataField = Static<typeof fieldsSchema>;
export type TAppDataEntityFields = Static<typeof entityFields>;

export const entitiesSchema = tb.Type.Object({
   type: tb.Type.Optional(
      tb.Type.String({ enum: entityTypes, default: "regular", readOnly: true }),
   ),
   config: tb.Type.Optional(entityConfigSchema),
   fields: tb.Type.Optional(entityFields),
});
export type TAppDataEntity = Static<typeof entitiesSchema>;

export const relationsSchema = Object.entries(RelationClassMap).map(([name, relationClass]) => {
   return tb.Type.Object(
      {
         type: tb.Type.Const(name, { default: name, readOnly: true }),
         source: tb.Type.String(),
         target: tb.Type.String(),
         config: tb.Type.Optional(relationClass.schema),
      },
      {
         title: name,
      },
   );
});
export type TAppDataRelation = Static<(typeof relationsSchema)[number]>;

export const indicesSchema = tb.Type.Object(
   {
      entity: tb.Type.String(),
      fields: tb.Type.Array(tb.Type.String(), { minItems: 1 }),
      unique: tb.Type.Optional(tb.Type.Boolean({ default: false })),
   },
   {
      additionalProperties: false,
   },
);

export const dataConfigSchema = tb.Type.Object(
   {
      basepath: tb.Type.Optional(tb.Type.String({ default: "/api/data" })),
      default_primary_format: tb.Type.Optional(
         StringEnum(primaryFieldTypes, { default: "integer" }),
      ),
      entities: tb.Type.Optional(StringRecord(entitiesSchema, { default: {} })),
      relations: tb.Type.Optional(StringRecord(tb.Type.Union(relationsSchema), { default: {} })),
      indices: tb.Type.Optional(StringRecord(indicesSchema, { default: {} })),
   },
   {
      additionalProperties: false,
   },
);

export type AppDataConfig = Static<typeof dataConfigSchema>;
