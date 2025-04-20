import type { EntityManager } from "data";
import type { Static } from "core/utils";
import { TransformPersistFailedException } from "../errors";
import { Field, type TActionContext, baseFieldConfigSchema } from "./Field";
import * as tb from "@sinclair/typebox";
const { Type } = tb;

export const textFieldConfigSchema = Type.Composite(
   [
      Type.Object({
         default_value: Type.Optional(Type.String()),
         minLength: Type.Optional(Type.Number()),
         maxLength: Type.Optional(Type.Number()),
         pattern: Type.Optional(Type.String()),
         html_config: Type.Optional(
            Type.Object({
               element: Type.Optional(Type.String({ default: "input" })),
               props: Type.Optional(
                  Type.Object(
                     {},
                     {
                        additionalProperties: Type.Union([
                           Type.String({ title: "String" }),
                           Type.Number({ title: "Number" }),
                        ]),
                     },
                  ),
               ),
            }),
         ),
      }),
      baseFieldConfigSchema,
   ],
   {
      additionalProperties: false,
   },
);

export type TextFieldConfig = Static<typeof textFieldConfigSchema>;

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
         Type.String({
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
