import { Field, baseFieldConfigSchema } from "data/fields";
import { s } from "bknd/utils";

export const mediaFieldConfigSchema = s
   .strictObject({
      entity: s.string(), // @todo: is this really required?
      min_items: s.number(),
      max_items: s.number(),
      mime_types: s.array(s.string()),
      ...baseFieldConfigSchema.properties,
   })
   .partial();

export type MediaFieldConfig = s.Static<typeof mediaFieldConfigSchema>;

export type MediaItem = {
   id: number;
   path: string;
   mime_type: string;
   size: number;
   scope: number;
   etag: string;
   modified_at: Date;
   folder: boolean;
};

export class MediaField<
   Required extends true | false = false,
   TypeOverride = MediaItem[],
> extends Field<MediaFieldConfig, TypeOverride, Required> {
   override readonly type = "media";

   constructor(name: string, config: Partial<MediaFieldConfig>) {
      // field must be virtual, as it doesn't store a reference to the entity
      super(name, { ...config, fillable: ["update"], virtual: true });
   }

   protected getSchema() {
      return mediaFieldConfigSchema;
   }

   getMaxItems(): number | undefined {
      return this.config.max_items;
   }

   getMinItems(): number | undefined {
      return this.config.min_items;
   }

   override schema() {
      return undefined;
   }

   override toJsonSchema() {
      // @todo: should be a variable, since media could be a diff entity
      const $ref = "../schema.json#/properties/media";
      const minItems = this.config?.min_items;
      const maxItems = this.config?.max_items;

      if (maxItems === 1) {
         return { $ref } as any;
      } else {
         return {
            type: "array",
            items: { $ref },
            minItems,
            maxItems,
         };
      }
   }
}
