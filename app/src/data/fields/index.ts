import { BooleanField, type BooleanFieldConfig, booleanFieldConfigSchema } from "./BooleanField";
import { DateField, type DateFieldConfig, dateFieldConfigSchema } from "./DateField";
import { EnumField, type EnumFieldConfig, enumFieldConfigSchema } from "./EnumField";
import { JsonField, type JsonFieldConfig, jsonFieldConfigSchema } from "./JsonField";
import {
   JsonSchemaField,
   type JsonSchemaFieldConfig,
   jsonSchemaFieldConfigSchema,
} from "./JsonSchemaField";
import { NumberField, type NumberFieldConfig, numberFieldConfigSchema } from "./NumberField";
import { PrimaryField, type PrimaryFieldConfig, primaryFieldConfigSchema } from "./PrimaryField";
import { TextField, type TextFieldConfig, textFieldConfigSchema } from "./TextField";

export {
   PrimaryField,
   primaryFieldConfigSchema,
   type PrimaryFieldConfig,
   BooleanField,
   booleanFieldConfigSchema,
   type BooleanFieldConfig,
   DateField,
   dateFieldConfigSchema,
   type DateFieldConfig,
   EnumField,
   enumFieldConfigSchema,
   type EnumFieldConfig,
   JsonField,
   jsonFieldConfigSchema,
   type JsonFieldConfig,
   JsonSchemaField,
   jsonSchemaFieldConfigSchema,
   type JsonSchemaFieldConfig,
   NumberField,
   numberFieldConfigSchema,
   type NumberFieldConfig,
   TextField,
   textFieldConfigSchema,
   type TextFieldConfig,
};

export * from "./Field";
export * from "./PrimaryField";
export * from "./VirtualField";
export * from "./indices/EntityIndex";

export const FieldClassMap = {
   primary: { schema: primaryFieldConfigSchema, field: PrimaryField },
   text: { schema: textFieldConfigSchema, field: TextField },
   number: { schema: numberFieldConfigSchema, field: NumberField },
   boolean: { schema: booleanFieldConfigSchema, field: BooleanField },
   date: { schema: dateFieldConfigSchema, field: DateField },
   enum: { schema: enumFieldConfigSchema, field: EnumField },
   json: { schema: jsonFieldConfigSchema, field: JsonField },
   jsonschema: { schema: jsonSchemaFieldConfigSchema, field: JsonSchemaField },
} as const;

export { fieldTestSuite } from "./field-test-suite";
