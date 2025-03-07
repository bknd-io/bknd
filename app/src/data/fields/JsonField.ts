import { type Static, Type } from "core/utils";
import type { EntityManager } from "data";
import { TransformPersistFailedException } from "../errors";
import { Field, type TActionContext, type TRenderContext, baseFieldConfigSchema } from "./Field";

export const jsonFieldConfigSchema = Type.Composite([baseFieldConfigSchema, Type.Object({})]);

export type JsonFieldConfig = Static<typeof jsonFieldConfigSchema>;

export class JsonField<Required extends true | false = false, TypeOverride = object> extends Field<
   JsonFieldConfig,
   TypeOverride,
   Required
> {
   override readonly type = "json";

   protected getSchema() {
      return jsonFieldConfigSchema;
   }

   /**
    * Transform value after retrieving from database
    * @param value
    */
   override transformRetrieve(value: any): any {
      const val = super.transformRetrieve(value);

      if (val === null && this.hasDefault()) {
         return this.getDefault();
      }

      if (this.isSerialized(val)) {
         return JSON.parse(val);
      }

      return val;
   }

   isSerializable(value: any) {
      try {
         const stringified = JSON.stringify(value);
         if (stringified === JSON.stringify(JSON.parse(stringified))) {
            return true;
         }
      } catch (e) {}

      return false;
   }

   isSerialized(value: any) {
      try {
         if (typeof value === "string") {
            return value === JSON.stringify(JSON.parse(value));
         }
      } catch (e) {}

      return false;
   }

   override getValue(value: any, context: TRenderContext): any {
      switch (context) {
         case "form":
            if (value === null) return "";
            return JSON.stringify(value, null, 2);
         case "table":
            if (value === null) return null;
            return JSON.stringify(value);
         case "submit":
            if (typeof value === "string" && value.length === 0) {
               return null;
            }

            return JSON.parse(value);
      }

      return value;
   }

   override async transformPersist(
      _value: any,
      em: EntityManager<any>,
      context: TActionContext,
   ): Promise<string | undefined> {
      const value = await super.transformPersist(_value, em, context);
      //console.log("value", value);
      if (this.nullish(value)) return value;

      if (!this.isSerializable(value)) {
         throw new TransformPersistFailedException(
            `Field "${this.name}" must be serializable to JSON.`,
         );
      }

      if (this.isSerialized(value)) {
         return value;
      }

      return JSON.stringify(value);
   }
}
