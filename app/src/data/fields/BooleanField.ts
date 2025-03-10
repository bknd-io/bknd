import { type Static, Type } from "core/utils";
import type { EntityManager } from "data";
import { TransformPersistFailedException } from "../errors";
import { Field, type TActionContext, type TRenderContext, baseFieldConfigSchema } from "./Field";

export const booleanFieldConfigSchema = Type.Composite([
   Type.Object({
      default_value: Type.Optional(Type.Boolean({ default: false })),
   }),
   baseFieldConfigSchema,
]);

export type BooleanFieldConfig = Static<typeof booleanFieldConfigSchema>;

export class BooleanField<Required extends true | false = false> extends Field<
   BooleanFieldConfig,
   boolean,
   Required
> {
   override readonly type = "boolean";

   protected getSchema() {
      return booleanFieldConfigSchema;
   }

   override getValue(value: unknown, context: TRenderContext) {
      switch (context) {
         case "table":
            return value ? "Yes" : "No";
         default:
            return value;
      }
   }

   override schema() {
      return Object.freeze({
         ...super.schema()!,
         type: "boolean",
      });
   }

   override getHtmlConfig() {
      return {
         ...super.getHtmlConfig(),
         element: "boolean",
      };
   }

   override transformRetrieve(value: unknown): boolean | null {
      //console.log("Boolean:transformRetrieve:value", value);
      if (typeof value === "undefined" || value === null) {
         if (this.isRequired()) return false;
         if (this.hasDefault()) return this.getDefault();

         return null;
      }

      if (typeof value === "string") {
         return value === "1";
      }

      // cast to boolean, as it might be stored as number
      return !!value;
   }

   override async transformPersist(
      val: unknown,
      em: EntityManager<any>,
      context: TActionContext,
   ): Promise<boolean | undefined> {
      const value = await super.transformPersist(val, em, context);
      if (this.nullish(value)) {
         return this.isRequired() ? Boolean(this.config.default_value) : undefined;
      }

      if (typeof value === "number") {
         return value !== 0;
      }

      if (typeof value !== "boolean") {
         throw TransformPersistFailedException.invalidType(this.name, "boolean", value);
      }

      return value as boolean;
   }

   override toJsonSchema() {
      return this.toSchemaWrapIfRequired(Type.Boolean({ default: this.getDefault() }));
   }
}
