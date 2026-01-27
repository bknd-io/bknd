import { s } from "bknd/utils";
import { StorageAdapter } from "../../StorageAdapter";
import type { FileBody, FileListObject, FileMeta, FileUploadPayload } from "../../Storage";
import { localAdapterConfig, type LocalAdapterConfig } from "./local-adapter-schema";

/**
 * Base class for the local storage adapter.
 * This class provides the schema for the Admin UI registry without Node.js dependencies.
 * The actual implementation (StorageLocalAdapter) extends this and adds the file system operations.
 */
export class StorageLocalAdapterBase extends StorageAdapter {
   protected config: LocalAdapterConfig;

   constructor(config: Partial<LocalAdapterConfig> = {}) {
      super();
      // Basic config assignment - actual parsing happens in the real implementation
      this.config = { path: config.path ?? "./" };
   }

   getSchema(): s.Schema {
      return localAdapterConfig;
   }

   getName(): string {
      return "local";
   }

   async listObjects(_prefix?: string): Promise<FileListObject[]> {
      throw new Error("StorageLocalAdapterBase: Use StorageLocalAdapter from bknd/adapter/node for actual file operations");
   }

   async putObject(_key: string, _body: FileBody): Promise<string | FileUploadPayload> {
      throw new Error("StorageLocalAdapterBase: Use StorageLocalAdapter from bknd/adapter/node for actual file operations");
   }

   async deleteObject(_key: string): Promise<void> {
      throw new Error("StorageLocalAdapterBase: Use StorageLocalAdapter from bknd/adapter/node for actual file operations");
   }

   async objectExists(_key: string): Promise<boolean> {
      throw new Error("StorageLocalAdapterBase: Use StorageLocalAdapter from bknd/adapter/node for actual file operations");
   }

   async getObject(_key: string, _headers: Headers): Promise<Response> {
      throw new Error("StorageLocalAdapterBase: Use StorageLocalAdapter from bknd/adapter/node for actual file operations");
   }

   getObjectUrl(_key: string): string {
      throw new Error("StorageLocalAdapterBase: Use StorageLocalAdapter from bknd/adapter/node for actual file operations");
   }

   async getObjectMeta(_key: string): Promise<FileMeta> {
      throw new Error("StorageLocalAdapterBase: Use StorageLocalAdapter from bknd/adapter/node for actual file operations");
   }

   toJSON(_secrets?: boolean) {
      return {
         type: this.getName(),
         config: this.config,
      };
   }
}
