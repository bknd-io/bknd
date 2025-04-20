import type { TObject } from "@sinclair/typebox";
import { type Constructor, Registry } from "core";

export { guess as guessMimeType } from "./storage/mime-types-tiny";
export {
   Storage,
   type FileMeta,
   type FileListObject,
   type StorageConfig,
   type FileBody,
   type FileUploadPayload,
} from "./storage/Storage";
import { StorageAdapter } from "./storage/StorageAdapter";
import {
   type CloudinaryConfig,
   StorageCloudinaryAdapter,
} from "./storage/adapters/cloudinary/StorageCloudinaryAdapter";
import { type S3AdapterConfig, StorageS3Adapter } from "./storage/adapters/s3/StorageS3Adapter";

export { StorageAdapter };
export { StorageS3Adapter, type S3AdapterConfig, StorageCloudinaryAdapter, type CloudinaryConfig };

export * as StorageEvents from "./storage/events";
export * as MediaPermissions from "./media-permissions";
export type { FileUploadedEventData } from "./storage/events";
export * from "./utils";

type ClassThatImplements<T> = Constructor<T> & { prototype: T };

export const MediaAdapterRegistry = new Registry<{
   cls: ClassThatImplements<StorageAdapter>;
   schema: TObject;
}>((cls: ClassThatImplements<StorageAdapter>) => ({
   cls,
   schema: cls.prototype.getSchema() as TObject,
}))
   .register("s3", StorageS3Adapter)
   .register("cloudinary", StorageCloudinaryAdapter);

export const Adapters = {
   s3: {
      cls: StorageS3Adapter,
      schema: StorageS3Adapter.prototype.getSchema(),
   },
   cloudinary: {
      cls: StorageCloudinaryAdapter,
      schema: StorageCloudinaryAdapter.prototype.getSchema(),
   },
} as const;

export { adapterTestSuite } from "./storage/adapters/adapter-test-suite";
