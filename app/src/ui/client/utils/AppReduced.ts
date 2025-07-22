import type { App } from "App";
import type { Entity } from "data/entities";
import type { EntityRelation } from "data/relations";
import { constructEntity, constructRelation } from "data/schema/constructor";
import { RelationAccessor } from "data/relations/RelationAccessor";
import { Flow, TaskMap } from "flows";
import type { BkndAdminOptions } from "ui/client/BkndProvider";

export type AppType = ReturnType<App["toJSON"]>;

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
      protected _options: BkndAdminOptions = {},
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
         basepath: "",
         logo_return_path: "/",
         ...this._options,
      };
   }

   getSettingsPath(path: string[] = []): string {
      const base = `~/${this.options.basepath}/settings`.replace(/\/+/g, "/");
      return [base, ...path].join("/");
   }

   getAbsolutePath(path?: string): string {
      const { basepath } = this.options;
      return (path ? `~/${basepath}/${path}` : `~/${basepath}`).replace(/\/+/g, "/");
   }

   getAuthConfig() {
      return this.appJson.auth;
   }
}
