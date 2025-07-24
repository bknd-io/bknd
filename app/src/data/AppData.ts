import { transformObject } from "core/utils";

import { Module } from "modules/Module";
import { DataController } from "./api/DataController";
import { type AppDataConfig, dataConfigSchema } from "./data-schema";
import { constructEntity, constructRelation } from "./schema/constructor";
import type { Entity, EntityManager } from "data/entities";
import { EntityIndex } from "data/fields";
import * as DataPermissions from "data/permissions";

export class AppData extends Module<AppDataConfig> {
   override async build() {
      const {
         entities: _entities = {},
         relations: _relations = {},
         indices: _indices = {},
      } = this.config;

      const entities = transformObject(_entities, (entityConfig, name) => {
         return constructEntity(name, entityConfig);
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

      const indices = transformObject(_indices, (index, name) => {
         const entity = _entity(index.entity)!;
         const fields = index.fields.map((f) => entity.field(f)!);
         return new EntityIndex(entity, fields, index.unique, name);
      });

      for (const entity of Object.values(entities)) {
         this.ctx.em.addEntity(entity);
      }

      for (const relation of Object.values(relations)) {
         this.ctx.em.addRelation(relation);
      }

      for (const index of Object.values(indices)) {
         this.ctx.em.addIndex(index);
      }

      this.ctx.server.route(
         this.basepath,
         new DataController(this.ctx, this.config).getController(),
      );
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
}
