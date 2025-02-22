import type { PrimaryFieldType } from "core";
import { type Entity, EntityIndex, type EntityManager } from "data";
import { type FileUploadedEventData, Storage, type StorageAdapter } from "media";
import { Module } from "modules/Module";
import {
   type FieldSchema,
   boolean,
   datetime,
   em,
   entity,
   json,
   number,
   text
} from "../data/prototype";
import { MediaController } from "./api/MediaController";
import { ADAPTERS, buildMediaSchema, type mediaConfigSchema, registry } from "./media-schema";

export type MediaFieldSchema = FieldSchema<typeof AppMedia.mediaFields>;
declare module "core" {
   interface DB {
      media: { id: PrimaryFieldType } & MediaFieldSchema;
   }
}

export class AppMedia extends Module<typeof mediaConfigSchema> {
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
         this.ctx.server.route(this.basepath, new MediaController(this).getController());

         const media = this.getMediaEntity(true);
         this.ensureSchema(
            em({ [media.name as "media"]: media }, ({ index }, { media }) => {
               index(media).on(["path"], true).on(["reference"]).on(["entity_id"]);
            })
         );
      } catch (e) {
         console.error(e);
         throw new Error(
            `Could not build adapter with config ${JSON.stringify(this.config.adapter)}`
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

   uploadedEventDataToMediaPayload(info: FileUploadedEventData) {
      return {
         path: info.name,
         mime_type: info.meta.type,
         size: info.meta.size,
         etag: info.etag,
         modified_at: new Date()
      };
   }

   static mediaFields = {
      path: text().required(),
      folder: boolean({ default_value: false, hidden: true, fillable: ["create"] }),
      mime_type: text(),
      size: number(),
      scope: text({ hidden: true, fillable: ["create"] }),
      etag: text(),
      modified_at: datetime(),
      reference: text(),
      entity_id: number(),
      metadata: json()
   };

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
         { mode: "sync", id: "add-data-media" }
      );

      // when file is deleted, sync with media entity
      emgr.onEvent(
         Storage.Events.FileDeletedEvent,
         async (e) => {
            // simple file deletion sync
            const { data } = await em.repo(media).findOne({ path: e.params.name });
            if (data) {
               console.log("item.data", data);
               await em.mutator(media).deleteOne(data.id);
            }

            console.log("App:storage:file deleted", e);
         },
         { mode: "sync", id: "delete-data-media" }
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
         adapter: this.storage.getAdapter().toJSON(secrets)
      };
   }
}
