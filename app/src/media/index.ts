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

export { adapterTestSuite } from "./storage/adapters/adapter-test-suite";
