import { config } from "core";
import type { Static } from "core/utils";
import { Field, baseFieldConfigSchema } from "./Field";
import * as tbbox from "@sinclair/typebox";
import type { TFieldTSType } from "data/entities/EntityTypescript";
const { Type } = tbbox;

export const primaryFieldConfigSchema = Type.Composite([
   Type.Omit(baseFieldConfigSchema, ["required"]),
   Type.Object({
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

   constructor(name: string = config.data.default_primary_field) {
      super(name, { fillable: false, required: false });
   }

   override isRequired(): boolean {
      return false;
   }

   protected getSchema() {
      return baseFieldConfigSchema;
   }

   override schema() {
      return Object.freeze({
         type: "integer",
         name: this.name,
         primary: true,
         nullable: false,
      });
   }

   override async transformPersist(value: any): Promise<number> {
      throw new Error("PrimaryField: This function should not be called");
   }

   override toJsonSchema() {
      return this.toSchemaWrapIfRequired(Type.Number({ writeOnly: undefined }));
   }

   override toType(): TFieldTSType {
      return {
         ...super.toType(),
         required: true,
         import: [{ package: "kysely", name: "Generated" }],
         type: "Generated<number>",
      };
   }
}
