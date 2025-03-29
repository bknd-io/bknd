import { type EmitsEvents, EventManager } from "core/events";
import { isFile, detectImageDimensions } from "core/utils";
import { isMimeType } from "media/storage/mime-types-tiny";
import * as StorageEvents from "./events";
import type { FileUploadedEventData } from "./events";
import { $console } from "core";
import type { StorageAdapter } from "./StorageAdapter";

export type FileListObject = {
   key: string;
   last_modified: Date;
   size: number;
};

export type FileMeta = { type: string; size: number; width?: number; height?: number };
export type FileBody = ReadableStream | File;
export type FileUploadPayload = {
   name: string;
   meta: FileMeta;
   etag: string;
};

export type StorageConfig = {
   body_max_size?: number;
};

export class Storage implements EmitsEvents {
   readonly #adapter: StorageAdapter;
   static readonly Events = StorageEvents;
   readonly emgr: EventManager<typeof Storage.Events>;
   readonly config: StorageConfig;

   constructor(
      adapter: StorageAdapter,
      config: Partial<StorageConfig> = {},
      emgr?: EventManager<any>,
   ) {
      this.#adapter = adapter;
      this.config = {
         ...config,
         body_max_size: config.body_max_size,
      };

      this.emgr = emgr ?? new EventManager();
      this.emgr.registerEvents(Storage.Events);
   }

   getAdapter(): StorageAdapter {
      return this.#adapter;
   }

   async objectMetadata(key: string): Promise<FileMeta> {
      return await this.#adapter.getObjectMeta(key);
   }

   //randomizeFilename(filename: string): string {}

   getConfig(): StorageConfig {
      return this.config;
   }

   async uploadFile(
      file: FileBody,
      name: string,
      noEmit?: boolean,
   ): Promise<FileUploadedEventData> {
      const result = await this.#adapter.putObject(name, file);
      if (typeof result === "undefined") {
         throw new Error("Failed to upload file");
      }

      let info: FileUploadPayload = {
         name,
         meta: {
            size: 0,
            type: "application/octet-stream",
         },
         etag: typeof result === "string" ? result : "",
      };

      if (typeof result === "object") {
         info = result;
      } else if (isFile(file)) {
         info.meta.size = file.size;
         info.meta.type = file.type;
      }

      // try to get better meta info
      if (!isMimeType(info.meta.type, ["application/octet-stream", "application/json"])) {
         const meta = await this.#adapter.getObjectMeta(name);
         if (!meta) {
            throw new Error("Failed to get object meta");
         }
         info.meta = meta;
      }

      // try to get width/height for images
      if (info.meta.type.startsWith("image") && (!info.meta.width || !info.meta.height)) {
         try {
            const dim = await detectImageDimensions(file as File);
            info.meta = {
               ...info.meta,
               ...dim,
            };
         } catch (e) {
            $console.warn("Failed to get image dimensions", e);
         }
      }

      const eventData = {
         file,
         ...info,
         state: {
            name: info.name,
            path: info.name,
         },
      };
      if (!noEmit) {
         const result = await this.emgr.emit(new StorageEvents.FileUploadedEvent(eventData));
         if (result.returned) {
            return result.params;
         }
      }

      return eventData;
   }

   async deleteFile(name: string): Promise<void> {
      await this.#adapter.deleteObject(name);
      await this.emgr.emit(new StorageEvents.FileDeletedEvent({ name }));
   }

   async fileExists(name: string) {
      return await this.#adapter.objectExists(name);
   }
}
