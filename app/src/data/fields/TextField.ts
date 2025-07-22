import type { EntityManager } from "data/entities";
import { omitKeys } from "core/utils";
import { TransformPersistFailedException } from "../errors";
import { Field, type TActionContext, baseFieldConfigSchema } from "./Field";
import { s } from "bknd/utils";

export const textFieldConfigSchema = s
   .strictObject({
      default_value: s.string(),
      minLength: s.number(),
      maxLength: s.number(),
      pattern: s.string(),
      html_config: s.partialObject({
         element: s.string(),
         props: s.record(s.anyOf([s.string({ title: "String" }), s.number({ title: "Number" })])),
      }),
      ...omitKeys(baseFieldConfigSchema.properties, ["default_value"]),
   })
   .partial();

export type TextFieldConfig = s.Static<typeof textFieldConfigSchema>;

export class TextField<Required extends true | false = false> extends Field<
   TextFieldConfig,
   string,
   Required
> {
   override readonly type = "text";

   protected getSchema() {
      return textFieldConfigSchema;
   }

   override getHtmlConfig() {
      if (this.config.html_config) {
         return this.config.html_config as any;
      }

      return super.getHtmlConfig();
   }

   /**
    * Transform value after retrieving from database
    * @param value
    */
   override transformRetrieve(value: string): string | null {
      const val = super.transformRetrieve(value);

      // @todo: now sure about these two
      if (this.config.maxLength) {
         return val.substring(0, this.config.maxLength);
      }

      if (this.isRequired()) {
         return val ? val.toString() : "";
      }

      return val;
   }

   override async transformPersist(
      _value: any,
      em: EntityManager<any>,
      context: TActionContext,
   ): Promise<string | undefined> {
      let value = await super.transformPersist(_value, em, context);

      if (this.nullish(value)) return value;

      // transform to string
      if (value !== null && typeof value !== "string") {
         value = String(value);
      }

      if (this.config.maxLength && value?.length > this.config.maxLength) {
         throw new TransformPersistFailedException(
            `Field "${this.name}" must be at most ${this.config.maxLength} character(s)`,
         );
      }

      if (this.config.minLength && value?.length < this.config.minLength) {
         throw new TransformPersistFailedException(
            `Field "${this.name}" must be at least ${this.config.minLength} character(s)`,
         );
      }

      if (this.config.pattern && value && !new RegExp(this.config.pattern).test(value)) {
         throw new TransformPersistFailedException(
            `Field "${this.name}" must match the pattern ${this.config.pattern}`,
         );
      }

      return value;
   }

   override toJsonSchema() {
      return this.toSchemaWrapIfRequired(
         s.string({
            default: this.getDefault(),
            minLength: this.config?.minLength,
            maxLength: this.config?.maxLength,
            pattern: this.config?.pattern,
         }),
      );
   }

   override toType() {
      return {
         ...super.toType(),
         type: "string",
      };
   }
}
