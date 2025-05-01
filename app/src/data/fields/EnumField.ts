import { Const, type Static, StringEnum } from "core/utils";
import type { EntityManager } from "data";
import { TransformPersistFailedException } from "../errors";
import { baseFieldConfigSchema, Field, type TActionContext, type TRenderContext } from "./Field";
import * as tbbox from "@sinclair/typebox";
import type { TFieldTSType } from "data/entities/EntityTypescript";
const { Type } = tbbox;

export const enumFieldConfigSchema = Type.Composite(
   [
      Type.Object({
         default_value: Type.Optional(Type.String()),
         options: Type.Optional(
            Type.Union([
               Type.Object(
                  {
                     type: Const("strings"),
                     values: Type.Array(Type.String()),
                  },
                  { title: "Strings" },
               ),
               Type.Object(
                  {
                     type: Const("objects"),
                     values: Type.Array(
                        Type.Object({
                           label: Type.String(),
                           value: Type.String(),
                        }),
                     ),
                  },
                  {
                     title: "Objects",
                     additionalProperties: false,
                  },
               ),
            ]),
         ),
      }),
      baseFieldConfigSchema,
   ],
   {
      additionalProperties: false,
   },
);

export type EnumFieldConfig = Static<typeof enumFieldConfigSchema>;

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
         StringEnum(values, {
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
