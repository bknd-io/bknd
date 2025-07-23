import { s, objectTransform } from "bknd/utils";
import { Registry, type ClassThatImplements } from "core/registry/Registry";
import type { StorageAdapter } from "./storage/StorageAdapter";
import { StorageS3Adapter } from "./storage/adapters/s3/StorageS3Adapter";
import { StorageCloudinaryAdapter } from "./storage/adapters/cloudinary/StorageCloudinaryAdapter";

export const MediaAdapterRegistry = new Registry<{
   cls: ClassThatImplements<StorageAdapter>;
   schema: s.Schema;
}>((cls: ClassThatImplements<StorageAdapter>) => ({
   cls,
   schema: cls.prototype.getSchema() as s.Schema,
}))
   .register("s3", StorageS3Adapter)
   .register("cloudinary", StorageCloudinaryAdapter);

export function buildMediaSchema() {
   const adapterSchemaObject = objectTransform(MediaAdapterRegistry.all(), (adapter, name) => {
      return s.strictObject(
         {
            type: s.literal(name),
            config: adapter.schema,
         },
         {
            title: adapter.schema?.title ?? name,
            description: adapter.schema?.description,
         },
      );
   });

   return s.strictObject(
      {
         enabled: s.boolean({ default: false }),
         basepath: s.string({ default: "/api/media" }),
         entity_name: s.string({ default: "media" }),
         storage: s.strictObject(
            {
               body_max_size: s
                  .number({
                     description: "Max size of the body in bytes. Leave blank for unlimited.",
                  })
                  .optional(),
            },
            { default: {} },
         ),
         adapter: s.anyOf(Object.values(adapterSchemaObject)).optional(),
      },
      {
         default: {},
      },
   );
}

export const mediaConfigSchema = buildMediaSchema();
export type TAppMediaConfig = s.Static<typeof mediaConfigSchema>;
