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
         const cls = registry.get(type as any).cls;
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
