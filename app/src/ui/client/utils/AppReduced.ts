import type { App } from "App";
import { type Entity, type EntityRelation, constructEntity, constructRelation } from "data";
import { RelationAccessor } from "data/relations/RelationAccessor";
import { Flow, TaskMap } from "flows";
import type { BkndAdminOptions } from "ui/client/BkndProvider";

export type AppType = ReturnType<App["toJSON"]>;

/**
 * Normalize admin path by removing duplicate slashes and ensuring proper format
 * @param path - The path to normalize
 * @returns Normalized path
 * @private
 */
function normalizeAdminPath(path: string): string {
   // Remove duplicate slashes
   const normalized = path.replace(/\/+/g, "/");
   // Don't remove trailing slash if it's the only character or if path ends with entity/
   if (normalized === "/" || normalized.endsWith("/entity/")) {
      return normalized;
   }
   // Remove trailing slash for other paths
   return normalized.replace(/\/$/, "") || "/";
}

/**
 * Reduced version of the App class for frontend use
 * @todo: remove this class
 */
export class AppReduced {
   // @todo: change to record
   private _entities: Entity[] = [];
   private _relations: EntityRelation[] = [];
   private _flows: Flow[] = [];

   constructor(
      protected appJson: AppType,
      protected _options: BkndAdminOptions = {
         admin_basepath: '',
         logo_return_path: '/'
      },
   ) {
      //console.log("received appjson", appJson);

      this._entities = Object.entries(this.appJson.data.entities ?? {}).map(([name, entity]) => {
         return constructEntity(name, entity);
      });

      this._relations = Object.entries(this.appJson.data.relations ?? {}).map(([, relation]) => {
         return constructRelation(relation, this.entity.bind(this));
      });

      for (const [name, obj] of Object.entries(this.appJson.flows.flows ?? {})) {
         // @ts-ignore
         // @todo: fix constructing flow
         const flow = Flow.fromObject(name, obj, TaskMap);

         this._flows.push(flow);
      }
   }

   get entities(): Entity[] {
      return this._entities;
   }

   // @todo: change to record
   entity(_entity: Entity | string): Entity {
      const name = typeof _entity === "string" ? _entity : _entity.name;
      const entity = this._entities.find((entity) => entity.name === name);
      if (!entity) {
         throw new Error(`Entity "${name}" not found`);
      }

      return entity;
   }

   get relations(): RelationAccessor {
      return new RelationAccessor(this._relations);
   }

   get flows(): Flow[] {
      return this._flows;
   }

   get config() {
      return this.appJson;
   }

   get options() {
      return {
         admin_basepath: '',
         logo_return_path: '/',
         ...this._options,
      };
   }

   getSettingsPath(path: string[] = []): string {
      const base = `~/${this.options.admin_basepath}/settings`
      return normalizeAdminPath([base, ...path].join("/"));
   }

   getAbsolutePath(path?: string): string {
      return normalizeAdminPath((path ? `~/${this.options.admin_basepath}/${path}` : `~/${this.options.admin_basepath}`));
   }

   getAuthConfig() {
      return this.appJson.auth;
   }
}
