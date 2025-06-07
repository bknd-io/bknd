import { config } from "core";
import { StringEnum, uuidv7, type Static } from "core/utils";
import { Field, baseFieldConfigSchema } from "./Field";
import * as tbbox from "@sinclair/typebox";
import type { TFieldTSType } from "data/entities/EntityTypescript";
const { Type } = tbbox;

export const primaryFieldTypes = ["integer", "uuid"] as const;
export type TPrimaryFieldFormat = (typeof primaryFieldTypes)[number];

export const primaryFieldConfigSchema = Type.Composite([
   Type.Omit(baseFieldConfigSchema, ["required"]),
   Type.Object({
      format: Type.Optional(StringEnum(primaryFieldTypes, { default: "integer" })),
      required: Type.Optional(Type.Literal(false)),
   }),
]);

export type PrimaryFieldConfig = Static<typeof primaryFieldConfigSchema>;

export class PrimaryField<Required extends true | false = false> extends Field<
   PrimaryFieldConfig,
   string,
   Required
> {
   override readonly type = "primary";

   constructor(name: string = config.data.default_primary_field, cfg?: PrimaryFieldConfig) {
      super(name, { fillable: false, required: false, ...cfg });
   }

   override isRequired(): boolean {
      return false;
   }

   protected getSchema() {
      return primaryFieldConfigSchema;
   }

   get format() {
      return this.config.format ?? "integer";
   }

   get fieldType() {
      return this.format === "integer" ? "integer" : "text";
   }

   override schema() {
      return Object.freeze({
         type: this.fieldType,
         name: this.name,
         primary: true,
         nullable: false,
      });
   }

   getNewValue(): any {
      if (this.format === "uuid") {
         return uuidv7();
      }

      return undefined;
   }

   override async transformPersist(value: any): Promise<number> {
      throw new Error("PrimaryField: This function should not be called");
   }

   override toJsonSchema() {
      if (this.format === "uuid") {
         return this.toSchemaWrapIfRequired(Type.String({ writeOnly: undefined }));
      }

      return this.toSchemaWrapIfRequired(Type.Number({ writeOnly: undefined }));
   }

   override toType(): TFieldTSType {
      const type = this.format === "integer" ? "number" : "string";
      return {
         ...super.toType(),
         required: true,
         import: [{ package: "kysely", name: "Generated" }],
         type: `Generated<${type}>`,
      };
   }
}
