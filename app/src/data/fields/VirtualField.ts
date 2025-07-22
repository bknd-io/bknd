import { Field, baseFieldConfigSchema } from "./Field";
import { s } from "bknd/utils";

export const virtualFieldConfigSchema = s
   .strictObject({
      ...baseFieldConfigSchema.properties,
   })
   .partial();

export type VirtualFieldConfig = s.Static<typeof virtualFieldConfigSchema>;

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
         s.any({
            default: this.getDefault(),
            readOnly: true,
         }),
      );
   }
}
