import { type Static, Type } from "core/utils";
import type { EntityManager } from "data";
import { TransformPersistFailedException } from "../errors";
import { Field, type TActionContext, type TRenderContext, baseFieldConfigSchema } from "./Field";

export const numberFieldConfigSchema = Type.Composite(
   [
      Type.Object({
         default_value: Type.Optional(Type.Number()),
         minimum: Type.Optional(Type.Number()),
         maximum: Type.Optional(Type.Number()),
         exclusiveMinimum: Type.Optional(Type.Number()),
         exclusiveMaximum: Type.Optional(Type.Number()),
         multipleOf: Type.Optional(Type.Number()),
      }),
      baseFieldConfigSchema,
   ],
   {
      additionalProperties: false,
   },
);

export type NumberFieldConfig = Static<typeof numberFieldConfigSchema>;

export class NumberField<Required extends true | false = false> extends Field<
   NumberFieldConfig,
   number,
   Required
> {
   override readonly type = "number";

   protected getSchema() {
      return numberFieldConfigSchema;
   }

   override getHtmlConfig() {
      return {
         element: "input",
         props: {
            type: "number",
            pattern: "d*",
            inputMode: "numeric",
         } as any, // @todo: react expects "inputMode", but type dictates "inputmode"
      };
   }

   override schema() {
      return Object.freeze({
         ...super.schema()!,
         type: "integer",
      });
   }

   override getValue(value: any, context?: TRenderContext): any {
      if (typeof value === "undefined" || value === null) return null;

      switch (context) {
         case "submit":
            return Number.parseInt(value);
      }

      return value;
   }

   override async transformPersist(
      _value: unknown,
      em: EntityManager<any>,
      context: TActionContext,
   ): Promise<number | undefined> {
      const value = await super.transformPersist(_value, em, context);

      if (!this.nullish(value) && typeof value !== "number") {
         throw TransformPersistFailedException.invalidType(this.name, "number", value);
      }

      if (this.config.maximum && (value as number) > this.config.maximum) {
         throw new TransformPersistFailedException(
            `Field "${this.name}" cannot be greater than ${this.config.maximum}`,
         );
      }

      if (this.config.minimum && (value as number) < this.config.minimum) {
         throw new TransformPersistFailedException(
            `Field "${this.name}" cannot be less than ${this.config.minimum}`,
         );
      }

      return value as number;
   }

   override toJsonSchema() {
      return this.toSchemaWrapIfRequired(
         Type.Number({
            default: this.getDefault(),
            minimum: this.config?.minimum,
            maximum: this.config?.maximum,
            exclusiveMinimum: this.config?.exclusiveMinimum,
            exclusiveMaximum: this.config?.exclusiveMaximum,
            multipleOf: this.config?.multipleOf,
         }),
      );
   }
}
