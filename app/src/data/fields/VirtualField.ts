import { type Static, Type } from "core/utils";
import { Field, baseFieldConfigSchema } from "./Field";

export const virtualFieldConfigSchema = Type.Composite([baseFieldConfigSchema, Type.Object({})]);

export type VirtualFieldConfig = Static<typeof virtualFieldConfigSchema>;

export class VirtualField extends Field<VirtualFieldConfig> {
   override readonly type = "virtual";

   constructor(name: string, config?: Partial<VirtualFieldConfig>) {
      // field must be virtual, as it doesn't store a reference to the entity
      super(name, { ...config, fillable: false, virtual: true });
   }

   protected getSchema() {
      return virtualFieldConfigSchema;
   }

   override schema() {
      return undefined;
   }

   override toJsonSchema() {
      return this.toSchemaWrapIfRequired(
         Type.Any({
            default: this.getDefault(),
            readOnly: true,
         }),
      );
   }
}
