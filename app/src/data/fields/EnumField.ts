import { omitKeys } from "core/utils";
import type { EntityManager } from "data/entities";
import { TransformPersistFailedException } from "../errors";
import { baseFieldConfigSchema, Field, type TActionContext, type TRenderContext } from "./Field";
import type { TFieldTSType } from "data/entities/EntityTypescript";
import { s } from "bknd/utils";

export const enumFieldConfigSchema = s
   .strictObject({
      default_value: s.string(),
      options: s.anyOf([
         s.object({
            type: s.literal("strings"),
            values: s.array(s.string()),
         }),
         s.object({
            type: s.literal("objects"),
            values: s.array(
               s.object({
                  label: s.string(),
                  value: s.string(),
               }),
            ),
         }),
      ]),
      ...omitKeys(baseFieldConfigSchema.properties, ["default_value"]),
   })
   .partial();

export type EnumFieldConfig = s.Static<typeof enumFieldConfigSchema>;

export class EnumField<Required extends true | false = false, TypeOverride = string> extends Field<
   EnumFieldConfig,
   TypeOverride,
   Required
> {
   override readonly type = "enum";

   constructor(name: string, config: Partial<EnumFieldConfig>) {
      super(name, config);

      if (this.config.default_value && !this.isValidValue(this.config.default_value)) {
         throw new Error(`Default value "${this.config.default_value}" is not a valid option`);
      }
   }

   protected getSchema() {
      return enumFieldConfigSchema;
   }

   getOptions(): { label: string; value: string }[] {
      const options = this.config?.options ?? { type: "strings", values: [] };

      if (options.type === "strings") {
         return options.values?.map((option) => ({ label: option, value: option }));
      }

      return options?.values;
   }

   isValidValue(value: string): boolean {
      const valid_values = this.getOptions().map((option) => option.value);
      return valid_values.includes(value);
   }

   override getValue(value: any, context: TRenderContext) {
      if (!this.isValidValue(value)) {
         return this.hasDefault() ? this.getDefault() : null;
      }

      switch (context) {
         case "table":
            return this.getOptions().find((option) => option.value === value)?.label ?? value;
      }

      return value;
   }

   /**
    * Transform value after retrieving from database
    * @param value
    */
   override transformRetrieve(value: string | null): string | null {
      const val = super.transformRetrieve(value);

      if (val === null && this.hasDefault()) {
         return this.getDefault();
      }

      if (!this.isValidValue(val)) {
         return this.hasDefault() ? this.getDefault() : null;
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

      if (!this.isValidValue(value)) {
         throw new TransformPersistFailedException(
            `Field "${this.name}" must be one of the following values: ${this.getOptions()
               .map((o) => o.value)
               .join(", ")}`,
         );
      }

      return value;
   }

   override toJsonSchema() {
      const options = this.config?.options ?? { type: "strings", values: [] };
      const values =
         options.values?.map((option) => (typeof option === "string" ? option : option.value)) ??
         [];
      return this.toSchemaWrapIfRequired(
         s.string({
            enum: values,
            default: this.getDefault(),
         }),
      );
   }

   override toType(): TFieldTSType {
      const union = this.getOptions().map(({ value }) =>
         typeof value === "string" ? `"${value}"` : value,
      );
      return {
         ...super.toType(),
         type: union.length > 0 ? union.join(" | ") : "string",
      };
   }
}
