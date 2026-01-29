import type { AppEntity, FileUploadedEventData, StorageAdapter } from "bknd";
import { $console } from "bknd/utils";
import type { Entity, EntityManager } from "data/entities";
import { Storage } from "media/storage/Storage";
import { Module } from "modules/Module";
import { type FieldSchema, em, entity } from "../data/prototype";
import { MediaController } from "./api/MediaController";
import { buildMediaSchema, registry, type TAppMediaConfig } from "./media-schema";
import { mediaFields } from "./media-entities";
import * as MediaPermissions from "media/media-permissions";
import * as DatabaseEvents from "data/events";
import type { AdapterType } from "./storage/adapter-schemas";

export type MediaFields = typeof AppMedia.mediaFields;
export type MediaFieldSchema = FieldSchema<typeof AppMedia.mediaFields>;
declare module "bknd" {
   interface Media extends AppEntity, MediaFieldSchema {}
   interface DB {
      media: Media;
   }
}

// @todo: current workaround to make it all required
export class AppMedia extends Module<Required<TAppMediaConfig>> {
   private _storage?: Storage;
   options = {
      body_max_size: null as number | null,
   };

   /**
    * Get the adapter class for a given adapter type.
    * For adapters not in the registry (like "local" in non-Node environments),
    * this will attempt dynamic import.
    */
   private async getAdapterClass(type: AdapterType): Promise<new (config: any) => StorageAdapter> {
      // First, check if the adapter is already registered in the registry
      const registered = registry.get(type as any);
      if (registered?.cls) {
         return registered.cls;
      }

      // If not registered, try to dynamically import based on type
      switch (type) {
         case "local": {
            try {
               // Dynamically import the real local adapter from the built package path
               // Use a variable path to prevent bundlers from statically analyzing and bundling this import
               const adapterPath = "bknd/adapter/node";
               const { StorageLocalAdapter } = await import(/* @vite-ignore */ adapterPath);
               // Register it for future use
               registry.register("local", StorageLocalAdapter);
               return StorageLocalAdapter;
            } catch (_importError) {
               throw new Error(
                  "Local storage adapter requires Node.js or Bun runtime. " +
                     "Make sure you're running on a supported platform or use a different adapter (e.g., S3, Cloudinary)."
               );
            }
         }
         default:
          throw new Error(`Unknown adapter type: ${type}`);
      }
   }

   override async build() {
      if (!this.config.enabled) {
         this.setBuilt();
         return;
      }

      if (!this.config.adapter) {
         console.info("No storage adapter provided, skip building media.");
         return;
      }

      // build adapter
      let adapter: StorageAdapter;
      try {
         const { type, config } = this.config.adapter;
         const cls = await this.getAdapterClass(type as AdapterType);
         adapter = new cls(config as any);

         this._storage = new Storage(adapter, this.config.storage, this.ctx.emgr);
         this.setBuilt();
         this.setupListeners();
         this.ctx.guard.registerPermissions(MediaPermissions);
         this.ctx.server.route(this.basepath, new MediaController(this).getController());

         const media = this.getMediaEntity(true);
         this.ctx.helper.ensureSchema(
            em({ [media.name as "media"]: media }, ({ index }, { media }) => {
               index(media).on(["path"], true).on(["reference"]).on(["entity_id"]);
            }),
         );
      } catch (e) {
         console.error(e);
         throw new Error(
            `Could not build adapter with config ${JSON.stringify(this.config.adapter)}`,
         );
      }
   }

   getSchema() {
      return buildMediaSchema();
   }

   get basepath() {
      return this.config.basepath;
   }

   get storage(): Storage {
      this.throwIfNotBuilt();
      return this._storage!;
   }

   uploadedEventDataToMediaPayload(info: FileUploadedEventData): MediaFieldSchema {
      const metadata: any = {};
      if (info.meta.width && info.meta.height) {
         metadata.width = info.meta.width;
         metadata.height = info.meta.height;
      }

      return {
         path: info.name,
         mime_type: info.meta.type,
         size: info.meta.size,
         etag: info.etag,
         modified_at: new Date(),
         metadata,
      };
   }

   static mediaFields = mediaFields;

   getMediaEntity(forceCreate?: boolean): Entity<"media", typeof AppMedia.mediaFields> {
      const entity_name = this.config.entity_name;
      if (forceCreate || !this.em.hasEntity(entity_name)) {
         return entity(entity_name as "media", AppMedia.mediaFields, undefined, "system");
      }

      return this.em.entity(entity_name) as any;
   }

   get em(): EntityManager {
      return this.ctx.em;
   }

   private setupListeners() {
      //const media = this._entity;
      const { emgr, em } = this.ctx;
      const media = this.getMediaEntity().name as "media";

      // when file is uploaded, sync with media entity
      // @todo: need a way for singleton events!
      emgr.onEvent(
         Storage.Events.FileUploadedEvent,
         async (e) => {
            const mutator = em.mutator(media);
            mutator.__unstable_toggleSystemEntityCreation(false);
            const payload = this.uploadedEventDataToMediaPayload(e.params);
            const { data } = await mutator.insertOne(payload);
            mutator.__unstable_toggleSystemEntityCreation(true);
            return { data };
         },
         { mode: "sync", id: "add-data-media" },
      );

      // when file is deleted, sync with media entity
      emgr.onEvent(
         Storage.Events.FileDeletedEvent,
         async (e) => {
            // simple file deletion sync
            const { data } = await em.repo(media).findOne({ path: e.params.name });
            if (data) {
               await em.mutator(media).deleteOne(data.id);
            }

            $console.log("App:storage:file deleted", e.params);
         },
         { mode: "sync", id: "delete-data-media" },
      );

      emgr.onEvent(
         DatabaseEvents.MutatorDeleteAfter,
         async (e) => {
            const { entity, data } = e.params;
            const fields = entity.fields.filter((f) => f.type === "media");
            if (fields.length > 0) {
               const references = fields.map((f) => `${entity.name}.${f.name}`);
               $console.log("App:storage:file cleaning up", {
                  reference: { $in: references },
                  entity_id: String(data.id),
               });
               const { data: deleted } = await em.mutator(media).deleteWhere({
                  reference: { $in: references },
                  entity_id: String(data.id),
               });
               for (const file of deleted) {
                  await this.storage.deleteFile(file.path);
               }
               $console.log("App:storage:file cleaned up files:", deleted.length);
            }
         },
         { mode: "async", id: "delete-data-media-after" },
      );
   }

   override getOverwritePaths() {
      // if using 'set' or mocked 'set' (patch), then "." is prepended
      return [/^\.?adapter$/];
   }

   // @todo: add unit tests for toJSON!
   override toJSON(secrets?: boolean) {
      if (!this.isBuilt() || !this.config.enabled) {
         return this.configDefault;
      }

      return {
         ...this.config,
         adapter: this.storage.getAdapter().toJSON(secrets),
      };
   }
}
