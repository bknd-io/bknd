import { type Schema as JsonSchema, Validator } from "@cfworker/json-schema";
import { Default, FromSchema, objectToJsLiteral, type Static } from "core/utils";
import type { EntityManager } from "data";
import { TransformPersistFailedException } from "../errors";
import { Field, type TActionContext, type TRenderContext, baseFieldConfigSchema } from "./Field";
import * as tbbox from "@sinclair/typebox";
import type { TFieldTSType } from "data/entities/EntityTypescript";
const { Type } = tbbox;

export const jsonSchemaFieldConfigSchema = Type.Composite(
   [
      Type.Object({
         schema: Type.Object({}, { default: {} }),
         ui_schema: Type.Optional(Type.Object({})),
         default_from_schema: Type.Optional(Type.Boolean()),
      }),
      baseFieldConfigSchema,
   ],
   {
      additionalProperties: false,
   },
);

export type JsonSchemaFieldConfig = Static<typeof jsonSchemaFieldConfigSchema>;

export class JsonSchemaField<
   Required extends true | false = false,
   TypeOverride = object,
> extends Field<JsonSchemaFieldConfig, TypeOverride, Required> {
   override readonly type = "jsonschema";
   private validator: Validator;

   constructor(name: string, config: Partial<JsonSchemaFieldConfig>) {
      super(name, config);
      this.validator = new Validator(this.getJsonSchema());
   }

   protected getSchema() {
      return jsonSchemaFieldConfigSchema;
   }

   getJsonSchema(): JsonSchema {
      return this.config?.schema as JsonSchema;
   }

   getJsonUiSchema() {
      return this.config.ui_schema ?? {};
   }

   override isValid(value: any, context: TActionContext = "update"): boolean {
      const parentValid = super.isValid(value, context);

      if (parentValid) {
         // already checked in parent
         if (!this.isRequired() && (!value || typeof value !== "object")) {
            return true;
         }

         const result = this.validator.validate(value);
         return result.valid;
      }

      return false;
   }

   override getValue(value: any, context: TRenderContext): any {
      switch (context) {
         case "form":
            if (value === null) return "";
            return value;
         case "table":
            if (value === null) return null;
            return JSON.stringify(value);
         case "submit":
            break;
      }

      return value;
   }

   override transformRetrieve(value: any): any {
      const val = super.transformRetrieve(value);

      if (val === null) {
         if (this.config.default_from_schema) {
            try {
               return Default(FromSchema(this.getJsonSchema()), {});
            } catch (e) {
               return null;
            }
         } else if (this.hasDefault()) {
            return this.getDefault();
         }
      }

      return val;
   }

   override async transformPersist(
      _value: any,
      em: EntityManager<any>,
      context: TActionContext,
   ): Promise<string | undefined> {
      const value = await super.transformPersist(_value, em, context);
      if (this.nullish(value)) return value;

      if (!this.isValid(value)) {
         throw new TransformPersistFailedException(this.name, value);
      }

      if (!value || typeof value !== "object") return this.getDefault();

      return JSON.stringify(value);
   }

   override toJsonSchema() {
      const schema = this.getJsonSchema() ?? { type: "object" };
      return this.toSchemaWrapIfRequired(
         FromSchema({
            default: this.getDefault(),
            ...schema,
         }),
      );
   }

   override toType(): TFieldTSType {
      return {
         ...super.toType(),
         import: [{ package: "json-schema-to-ts", name: "FromSchema" }],
         type: `FromSchema<${objectToJsLiteral(this.getJsonSchema(), 2, 1)}>`,
      };
   }
}
