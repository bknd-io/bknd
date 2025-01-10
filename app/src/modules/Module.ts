import type { App } from "App";
import type { Guard } from "auth";
import { SchemaObject } from "core";
import type { EventManager } from "core/events";
import type { Static, TSchema } from "core/utils";
import type { Connection, EntityIndex, EntityManager, em as prototypeEm } from "data";
import { Entity } from "data";
import type { Hono } from "hono";

export type ServerEnv = {
   Variables: {
      app: App;
      auth_resolved: boolean;
      auth_registered: boolean;
      html?: string;
   };
};

export type ModuleBuildContext = {
   connection: Connection;
   server: Hono<ServerEnv>;
   em: EntityManager;
   emgr: EventManager<any>;
   guard: Guard;
   flags: (typeof Module)["ctx_flags"];
};

export abstract class Module<Schema extends TSchema = TSchema, ConfigSchema = Static<Schema>> {
   private _built = false;
   private _schema: SchemaObject<ReturnType<(typeof this)["getSchema"]>>;
   private _listener: any = () => null;

   constructor(
      initial?: Partial<Static<Schema>>,
      protected _ctx?: ModuleBuildContext
   ) {
      this._schema = new SchemaObject(this.getSchema(), initial, {
         forceParse: this.useForceParse(),
         onUpdate: async (c) => {
            await this._listener(c);
         },
         restrictPaths: this.getRestrictedPaths(),
         overwritePaths: this.getOverwritePaths(),
         onBeforeUpdate: this.onBeforeUpdate.bind(this)
      });
   }

   static ctx_flags = {
      sync_required: false
   } as {
      // signal that a sync is required at the end of build
      sync_required: boolean;
   };

   onBeforeUpdate(from: ConfigSchema, to: ConfigSchema): ConfigSchema | Promise<ConfigSchema> {
      return to;
   }

   setListener(listener: (c: ReturnType<(typeof this)["getSchema"]>) => void | Promise<void>) {
      this._listener = listener;
      return this;
   }

   // @todo: test all getSchema() for additional properties
   abstract getSchema();

   useForceParse() {
      return false;
   }

   getRestrictedPaths(): string[] | undefined {
      return undefined;
   }

   /**
    * These paths will be overwritten, even when "patch" is called.
    * This is helpful if there are keys that contains records, which always be sent in full.
    */
   getOverwritePaths(): (RegExp | string)[] | undefined {
      return undefined;
   }

   get configDefault(): Static<ReturnType<(typeof this)["getSchema"]>> {
      return this._schema.default();
   }

   get config(): Static<ReturnType<(typeof this)["getSchema"]>> {
      return this._schema.get();
   }

   setContext(ctx: ModuleBuildContext) {
      this._ctx = ctx;
      return this;
   }

   schema() {
      return this._schema;
   }

   // action performed when server has been initialized
   // can be used to assign global middlewares
   onServerInit(hono: Hono<ServerEnv>) {}

   get ctx() {
      if (!this._ctx) {
         throw new Error("Context not set");
      }
      return this._ctx;
   }

   async build() {
      throw new Error("Not implemented");
   }

   setBuilt() {
      this._built = true;
      this._schema = new SchemaObject(this.getSchema(), this.toJSON(true), {
         onUpdate: async (c) => {
            await this._listener(c);
         },
         forceParse: this.useForceParse(),
         restrictPaths: this.getRestrictedPaths(),
         overwritePaths: this.getOverwritePaths(),
         onBeforeUpdate: this.onBeforeUpdate.bind(this)
      });
   }

   isBuilt() {
      return this._built;
   }

   throwIfNotBuilt() {
      if (!this._built) {
         throw new Error("Config not built: " + this.constructor.name);
      }
   }

   toJSON(secrets?: boolean): Static<ReturnType<(typeof this)["getSchema"]>> {
      return this.config;
   }

   protected ensureEntity(entity: Entity) {
      // check fields
      if (!this.ctx.em.hasEntity(entity.name)) {
         this.ctx.em.addEntity(entity);
         this.ctx.flags.sync_required = true;
         return;
      }

      const instance = this.ctx.em.entity(entity.name);

      // if exists, check all fields required are there
      // @todo: check if the field also equal
      for (const field of instance.fields) {
         const _field = entity.field(field.name);
         if (!_field) {
            entity.addField(field);
            this.ctx.flags.sync_required = true;
         }
      }

      // replace entity (mainly to keep the ensured type)
      this.ctx.em.__replaceEntity(
         new Entity(entity.name, entity.fields, instance.config, entity.type)
      );
   }

   protected ensureIndex(index: EntityIndex) {
      if (!this.ctx.em.hasIndex(index)) {
         this.ctx.em.addIndex(index);
         this.ctx.flags.sync_required = true;
      }
   }

   protected ensureSchema<Schema extends ReturnType<typeof prototypeEm>>(schema: Schema): Schema {
      Object.values(schema.entities ?? {}).forEach(this.ensureEntity.bind(this));
      schema.indices?.forEach(this.ensureIndex.bind(this));

      return schema;
   }
}
