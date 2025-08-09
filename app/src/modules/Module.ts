import type { App } from "bknd";
import type { EventManager } from "core/events";
import type { Connection } from "data/connection";
import type { EntityManager } from "data/entities";
import type { Hono } from "hono";
import type { ServerEnv } from "modules/Controller";
import type { ModuleHelper } from "./ModuleHelper";
import { SchemaObject } from "core/object/SchemaObject";
import type { DebugLogger } from "core/utils/DebugLogger";
import type { Guard } from "auth/authorize/Guard";
import type { McpServer } from "bknd/utils";

type PartialRec<T> = { [P in keyof T]?: PartialRec<T[P]> };

export type ModuleBuildContextMcpContext = {
   app: App;
   ctx: () => ModuleBuildContext;
};
export type ModuleBuildContext = {
   connection: Connection;
   server: Hono<ServerEnv>;
   em: EntityManager;
   emgr: EventManager<any>;
   guard: Guard;
   logger: DebugLogger;
   flags: (typeof Module)["ctx_flags"];
   helper: ModuleHelper;
   mcp: McpServer<ModuleBuildContextMcpContext>;
};

export abstract class Module<Schema extends object = object> {
   private _built = false;
   private _schema: SchemaObject<ReturnType<(typeof this)["getSchema"]>>;
   private _listener: any = () => null;

   constructor(
      initial?: PartialRec<Schema>,
      protected _ctx?: ModuleBuildContext,
   ) {
      this._schema = new SchemaObject(this.getSchema(), initial, {
         forceParse: this.useForceParse(),
         onUpdate: async (c) => {
            await this._listener(c);
         },
         restrictPaths: this.getRestrictedPaths(),
         overwritePaths: this.getOverwritePaths(),
         onBeforeUpdate: this.onBeforeUpdate.bind(this),
      });
   }

   static ctx_flags = {
      sync_required: false,
      ctx_reload_required: false,
   } as {
      // signal that a sync is required at the end of build
      sync_required: boolean;
      ctx_reload_required: boolean;
   };

   onBeforeUpdate(from: Schema, to: Schema): Schema | Promise<Schema> {
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

   //get configDefault(): s.Static<ReturnType<(typeof this)["getSchema"]>> {
   get configDefault(): Schema {
      return this._schema.default() as any;
   }

   //get config(): s.Static<ReturnType<(typeof this)["getSchema"]>> {
   get config(): Schema {
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
         onBeforeUpdate: this.onBeforeUpdate.bind(this),
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

   //toJSON(secrets?: boolean): s.Static<ReturnType<(typeof this)["getSchema"]>> {
   toJSON(secrets?: boolean): Schema {
      return this.config;
   }
}
