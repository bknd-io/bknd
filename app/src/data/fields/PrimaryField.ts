import { config } from "core/config";
import { omitKeys, uuidv7, s } from "bknd/utils";
import { Field, baseFieldConfigSchema } from "./Field";
import type { TFieldTSType } from "data/entities/EntityTypescript";

export const primaryFieldTypes = ["integer", "uuid"] as const;
export type TPrimaryFieldFormat = (typeof primaryFieldTypes)[number];

export const primaryFieldConfigSchema = s
   .strictObject({
      format: s.string({ enum: primaryFieldTypes, default: "integer" }),
      required: s.boolean({ default: false }),
      ...omitKeys(baseFieldConfigSchema.properties, ["required"]),
   })
   .partial();

export type PrimaryFieldConfig = s.Static<typeof primaryFieldConfigSchema>;

export class PrimaryField<Required extends true | false = false> extends Field<
   PrimaryFieldConfig,
   string,
   Required
> {
   override readonly type = "primary";

   constructor(name: string = config.data.default_primary_field, cfg?: PrimaryFieldConfig) {
      super(name, { ...cfg, fillable: false, required: false });
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

   get fieldType(): "integer" | "text" {
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
      return this.toSchemaWrapIfRequired(
         this.format === "integer"
            ? s.number({ writeOnly: undefined })
            : s.string({ writeOnly: undefined }),
      );
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
