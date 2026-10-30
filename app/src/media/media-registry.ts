import { type Constructor, Registry } from "core/registry/Registry";
import type { StorageAdapter } from "./storage/StorageAdapter";
import type { s } from "bknd/utils";
import { StorageS3Adapter } from "./storage/adapters/s3/StorageS3Adapter";
import { StorageCloudinaryAdapter } from "./storage/adapters/cloudinary/StorageCloudinaryAdapter";

type ClassThatImplements<T> = Constructor<T> & { prototype: T };

export const MediaAdapterRegistry = new Registry<{
   cls: ClassThatImplements<StorageAdapter>;
   schema: s.Schema;
}>((cls: ClassThatImplements<StorageAdapter>) => ({
   cls,
   schema: cls.prototype.getSchema() as s.Schema,
}))
   .register("s3", StorageS3Adapter)
   .register("cloudinary", StorageCloudinaryAdapter);

export const MediaAdapters = {
   s3: {
      cls: StorageS3Adapter,
      schema: StorageS3Adapter.prototype.getSchema(),
   },
   cloudinary: {
      cls: StorageCloudinaryAdapter,
      schema: StorageCloudinaryAdapter.prototype.getSchema(),
   },
} as const;
