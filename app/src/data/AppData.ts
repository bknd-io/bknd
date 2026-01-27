import { transformObject } from "bknd/utils";
import { Module } from "modules/Module";
import { DataController } from "./api/DataController";
import { type AppDataConfig, dataConfigSchema } from "./data-schema";
import { constructEntity, constructRelation } from "./schema/constructor";
import type { Entity, EntityManager } from "data/entities";
import { EntityIndex } from "data/fields";
import * as DataPermissions from "data/permissions";

export class AppData extends Module<AppDataConfig> {
   private _pendingIndices: Array<{ index: AppDataConfig["indices"][string]; name: string }> = [];

   override async build() {
      const {
         entities: _entities = {},
         relations: _relations = {},
         indices: _indices = {},
      } = this.config;

      const entities = transformObject(_entities, (entityConfig, name) => {
         return constructEntity(name as string, entityConfig);
      });

      const _entity = (_e: Entity | string): Entity => {
         const name = typeof _e === "string" ? _e : _e.name;
         const entity = entities[name];
         if (entity) return entity;
         throw new Error(`[AppData] Entity "${name}" not found`);
      };

      const relations = transformObject(_relations, (relation) =>
         constructRelation(relation, _entity),
      );

      // Store pending indices that reference fields that may not exist yet
      // (e.g., fields added by plugins). These will be resolved after plugins run.
      const pendingIndices: Array<{ index: typeof _indices[string]; name: string }> = [];
      
      const resolvedIndices = transformObject(_indices, (index, name) => {
         const entity = _entity(index.entity)!;
         const missingFields = index.fields.filter((f) => !entity.field(f));
         const indexName = name as string;
         
         if (missingFields.length > 0) {
            // Defer index creation - fields may be added by plugins
            pendingIndices.push({ index, name: indexName });
            // Return undefined to exclude from resolved indices (will be handled later)
            return undefined;
         }
         
         // All fields exist, create index immediately
         const fields = index.fields.map((f) => entity.field(f)!);
         return new EntityIndex(entity, fields, index.unique, indexName);
      });

      for (const entity of Object.values(entities)) {
         this.ctx.em.addEntity(entity as Entity);
      }

      for (const relation of Object.values(relations)) {
         this.ctx.em.addRelation(relation as any);
      }

      for (const index of Object.values(resolvedIndices)) {
         this.ctx.em.addIndex(index as EntityIndex);
      }

      // Store pending indices to be resolved after plugins run
      this._pendingIndices = pendingIndices;

      const dataController = new DataController(this.ctx, this.config);
      dataController.registerMcp();
      this.ctx.server.route(this.basepath, dataController.getController());
      this.ctx.guard.registerPermissions(Object.values(DataPermissions));

      this.setBuilt();
   }

   override async onBeforeUpdate(from: AppDataConfig, to: AppDataConfig): Promise<AppDataConfig> {
      // this is not 100% yet, since it could be legit
      const entities = {
         from: Object.keys(from.entities ?? {}),
         to: Object.keys(to.entities ?? {}),
      };
      if (entities.from.length - entities.to.length > 1) {
         throw new Error("Cannot remove more than one entity at a time");
      }

      return to;
   }

   getSchema() {
      return dataConfigSchema;
   }

   get em(): EntityManager {
      this.throwIfNotBuilt();
      return this.ctx.em;
   }

   private get basepath() {
      return this.config.basepath ?? "/api/data";
   }

   override getOverwritePaths() {
      return [/^entities\..*\.config$/, /^entities\..*\.fields\..*\.config$/];
   }

   override toJSON(secrets?: boolean): AppDataConfig {
      return {
         ...this.config,
         ...this.em.toJSON(),
      };
   }

   /**
    * Resolves pending indices that were deferred because their fields didn't exist yet.
    * This is called after plugin schemas are merged to resolve indices on plugin-added fields.
    */
   resolvePendingIndices() {
      if (this._pendingIndices.length === 0) {
         return;
      }

      const _entity = (_e: Entity | string): Entity => {
         const name = typeof _e === "string" ? _e : _e.name;
         const entity = this.ctx.em.entity(name);
         if (entity) return entity;
         throw new Error(`[AppData] Entity "${name}" not found`);
      };

      const resolved: EntityIndex[] = [];
      const stillPending: Array<{ index: AppDataConfig["indices"][string]; name: string }> = [];

      for (const { index, name } of this._pendingIndices) {
         const entity = _entity(index.entity);
         const missingFields = index.fields.filter((f) => !entity.field(f));

         if (missingFields.length > 0) {
            // Still missing fields - this is an error
            throw new Error(
               `Field "${missingFields[0]}" not found on entity "${index.entity}". ` +
                  `Available fields: ${entity.fields.map((f) => f.name).join(", ")}`,
            );
         }

         // All fields now exist, create the index
         const fields = index.fields.map((f) => entity.field(f)!);
         resolved.push(new EntityIndex(entity, fields, index.unique, name));
      }

      // Add resolved indices to the entity manager
      for (const index of resolved) {
         this.ctx.em.addIndex(index);
         this.ctx.flags.sync_required = true;
      }

      // Clear pending indices
      this._pendingIndices = stillPending;
   }
}
