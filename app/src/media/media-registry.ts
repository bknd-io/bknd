import { type Constructor, Registry } from "core/registry/Registry";
import type { StorageAdapter } from "./storage/StorageAdapter";
import type { s } from "bknd/utils";
import { StorageS3Adapter } from "./storage/adapters/s3/StorageS3Adapter";
import { StorageCloudinaryAdapter } from "./storage/adapters/cloudinary/StorageCloudinaryAdapter";

type ClassThatImplements<T> = Constructor<T> & { prototype: T };

/**
 * Registry for storage adapter implementations.
 *
 * Note: The "local" adapter is NOT registered here by default because it requires
 * Node.js filesystem APIs. It is registered at runtime by platform-specific code:
 * - Node.js: via `registerLocalMediaAdapter()` from "bknd/adapter/node"
 * - Bun: via `registerLocalMediaAdapter()` from "bknd/adapter/bun"
 * - CLI: automatically registered in the run command
 *
 * The Admin UI gets the list of available adapters from `adapter-schemas.ts`,
 * which includes all adapter schemas without Node.js dependencies.
 */
export const MediaAdapterRegistry = new Registry<{
   cls: ClassThatImplements<StorageAdapter>;
   schema: s.Schema;
}>((cls: ClassThatImplements<StorageAdapter>) => ({
   cls,
   schema: cls.prototype.getSchema() as s.Schema,
}))
   .register("s3", StorageS3Adapter)
   .register("cloudinary", StorageCloudinaryAdapter);
