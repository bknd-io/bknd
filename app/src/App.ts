import type { CreateUserPayload } from "auth/AppAuth";
import { $console, McpClient } from "bknd/utils";
import { Event } from "core/events";
import type { em as prototypeEm } from "data/prototype";
import { Connection } from "data/connection/Connection";
import type { Hono } from "hono";
import {
   type ModuleConfigs,
   type Modules,
   ModuleManager,
   type ModuleBuildContext,
   type ModuleManagerOptions,
} from "modules/ModuleManager";
import { DbModuleManager } from "modules/db/DbModuleManager";
import * as SystemPermissions from "modules/permissions";
import { AdminController, type AdminControllerOptions } from "modules/server/AdminController";
import { SystemController } from "modules/server/SystemController";
import type { MaybePromise, PartialRec } from "core/types";
import type { ServerEnv } from "modules/Controller";
import type { IEmailDriver, ICacheDriver } from "core/drivers";

// biome-ignore format: must be here
import { Api, type ApiOptions } from "Api";

export type AppPluginConfig = {
   /**
    * The name of the plugin.
    */
   name: string;
   /**
    * The schema of the plugin.
    */
   schema?: () => MaybePromise<ReturnType<typeof prototypeEm> | void>;
   /**
    * Called before the app is built.
    */
   beforeBuild?: () => MaybePromise<void>;
   /**
    * Called after the app is built.
    */
   onBuilt?: () => MaybePromise<void>;
   /**
    * Called when the server is initialized.
    */
   onServerInit?: (server: Hono<ServerEnv>) => MaybePromise<void>;
   /**
    * Called when the app is booted.
    */
   onBoot?: () => MaybePromise<void>;
   /**
    * Called when the app is first booted.
    */
   onFirstBoot?: () => MaybePromise<void>;
};
export type AppPlugin = (app: App) => AppPluginConfig;

abstract class AppEvent<A = {}> extends Event<{ app: App } & A> {}
export class AppConfigUpdatedEvent extends AppEvent<{
   module: string;
   config: ModuleConfigs[keyof ModuleConfigs];
}> {
   static override slug = "app-config-updated";
}
/**
 * @type {Event<{ app: App }>}
 */
export class AppBuiltEvent extends AppEvent {
   static override slug = "app-built";
}
export class AppFirstBoot extends AppEvent {
   static override slug = "app-first-boot";
}
export class AppRequest extends AppEvent<{ request: Request }> {
   static override slug = "app-request";
}
export class AppBeforeResponse extends AppEvent<{ request: Request; response: Response }> {
   static override slug = "app-before-response";
}
export const AppEvents = {
   AppConfigUpdatedEvent,
   AppBuiltEvent,
   AppFirstBoot,
   AppRequest,
   AppBeforeResponse,
} as const;

export type AppOptions = {
   plugins?: AppPlugin[];
   seed?: (ctx: ModuleBuildContext & { app: App }) => Promise<void>;
   manager?: Omit<ModuleManagerOptions, "initial" | "onUpdated" | "seed">;
   asyncEventsMode?: "sync" | "async" | "none";
   drivers?: {
      email?: IEmailDriver;
      cache?: ICacheDriver;
   };
   mode?: "db" | "code";
   readonly?: boolean;
};
export type CreateAppConfig = {
   connection?: Connection | { url: string };
   config?: PartialRec<ModuleConfigs>;
   options?: AppOptions;
};

export type AppConfig = { version: number } & ModuleConfigs;
export type LocalApiOptions = Request | ApiOptions;

export class App<
   C extends Connection = Connection,
   Config extends PartialRec<ModuleConfigs> = PartialRec<ModuleConfigs>,
   Options extends AppOptions = AppOptions,
> {
   static readonly Events = AppEvents;

   modules: ModuleManager;
   adminController?: AdminController;
   _id: string = crypto.randomUUID();
   plugins: Map<string, AppPluginConfig> = new Map();
   drivers: Options["drivers"] = {};

   private trigger_first_boot = false;
   private _building: boolean = false;
   private _systemController: SystemController | null = null;

   constructor(
      public connection: C,
      _config?: Config,
      public options?: Options,
   ) {
      this.drivers = options?.drivers ?? {};

      for (const plugin of options?.plugins ?? []) {
         const config = plugin(this);
         if (this.plugins.has(config.name)) {
            throw new Error(`Plugin ${config.name} already registered`);
         }
         this.plugins.set(config.name, config);
      }
      this.runPlugins("onBoot");

      // use db manager by default
      const Manager = this.mode === "db" ? DbModuleManager : ModuleManager;

      this.modules = new Manager(connection, {
         ...(options?.manager ?? {}),
         initial: _config,
         onUpdated: this.onUpdated.bind(this),
         onFirstBoot: this.onFirstBoot.bind(this),
         onServerInit: this.onServerInit.bind(this),
         onModulesBuilt: this.onModulesBuilt.bind(this),
      });
      this.modules.ctx().emgr.registerEvents(AppEvents);
   }

   get mode() {
      return this.options?.mode ?? "db";
   }

   isReadOnly() {
      return Boolean(this.mode === "code" || this.options?.readonly);
   }

   get emgr() {
      return this.modules.ctx().emgr;
   }

   protected async runPlugins<Key extends keyof AppPluginConfig>(
      key: Key,
      ...args: any[]
   ): Promise<{ name: string; result: any }[]> {
      const results: { name: string; result: any }[] = [];
      for (const [name, config] of this.plugins) {
         try {
            if (key in config && config[key]) {
               const fn = config[key];
               if (fn && typeof fn === "function") {
                  $console.debug(`[Plugin:${name}] ${key}`);
                  // @ts-expect-error
                  const result = await fn(...args);
                  results.push({
                     name,
                     result,
                  });
               }
            }
         } catch (e) {
            $console.warn(`[Plugin:${name}] error running "${key}"`, String(e));
         }
      }
      return results as any;
   }

   async build(options?: { sync?: boolean; forceBuild?: boolean; [key: string]: any }) {
      // prevent multiple concurrent builds
      if (this._building) {
         while (this._building) {
            await new Promise((resolve) => setTimeout(resolve, 10));
         }
         if (!options?.forceBuild) return;
      }

      await this.runPlugins("beforeBuild");
      this._building = true;

      if (options?.sync) this.modules.ctx().flags.sync_required = true;
      await this.modules.build();

      const { guard } = this.modules.ctx();

      // load system controller
      guard.registerPermissions(Object.values(SystemPermissions));
      this._systemController = new SystemController(this);
      this._systemController.register(this);

      // emit built event
      $console.log("App built");
      await this.emgr.emit(new AppBuiltEvent({ app: this }));
      await this.runPlugins("onBuilt");

      // first boot is set from ModuleManager when there wasn't a config table
      if (this.trigger_first_boot) {
         this.trigger_first_boot = false;
         await this.emgr.emit(new AppFirstBoot({ app: this }));
         await this.options?.seed?.({
            ...this.modules.ctx(),
            app: this,
         });
      }

      this._building = false;
   }

   get server() {
      return this.modules.server;
   }

   get em() {
      return this.modules.ctx().em;
   }

   get mcp() {
      return this._systemController?._mcpServer;
   }

   get fetch(): Hono["fetch"] {
      if (!this.isBuilt()) {
         console.error("App is not built yet, run build() first");
      }
      return this.server.fetch as any;
   }

   get module() {
      return new Proxy(
         {},
         {
            get: (_, module: keyof Modules) => {
               return this.modules.get(module);
            },
         },
      ) as Modules;
   }

   getSchema() {
      return this.modules.getSchema();
   }

   version() {
      return this.modules.version();
   }

   isBuilt(): boolean {
      return this.modules.isBuilt();
   }

   registerAdminController(config?: AdminControllerOptions) {
      // register admin
      this.adminController = new AdminController(this, config);
      this.modules.server.route(
         this.adminController.basepath,
         this.adminController.getController(),
      );
      return this;
   }

   toJSON(secrets?: boolean) {
      return this.modules.toJSON(secrets);
   }

   static create(config: CreateAppConfig) {
      return createApp(config);
   }

   async createUser(p: CreateUserPayload) {
      return this.module.auth.createUser(p);
   }

   // @todo: potentially add option to clone the app, so that when used in listeners, it won't trigger listeners
   getApi(options?: LocalApiOptions) {
      const fetcher = this.server.request as typeof fetch;
      if (options && options instanceof Request) {
         return new Api({ request: options, headers: options.headers, fetcher });
      }

      return new Api({ host: "http://localhost", ...(options ?? {}), fetcher });
   }

   getMcpClient() {
      const config = this.modules.get("server").config.mcp;
      if (!config.enabled) {
         throw new Error("MCP is not enabled");
      }

      const url = new URL(config.path, "http://localhost").toString();
      return new McpClient({
         url,
         fetch: this.server.request,
      });
   }

   async onUpdated<Module extends keyof Modules>(module: Module, config: ModuleConfigs[Module]) {
      // if the EventManager was disabled, we assume we shouldn't
      // respond to events, such as "onUpdated".
      // this is important if multiple changes are done, and then build() is called manually
      if (!this.emgr.enabled) {
         $console.warn("App config updated, but event manager is disabled, skip.");
         return;
      }

      $console.log("App config updated", module);
      // @todo: potentially double syncing
      await this.build({ sync: true });
      await this.emgr.emit(new AppConfigUpdatedEvent({ app: this, module, config }));
   }

   protected async onFirstBoot() {
      $console.log("App first boot");
      this.trigger_first_boot = true;
      await this.runPlugins("onFirstBoot");
   }

   protected async onServerInit(server: Hono<ServerEnv>) {
      server.use(async (c, next) => {
         c.set("app", this);
         await this.emgr.emit(new AppRequest({ app: this, request: c.req.raw }));
         await next();

         try {
            // gracefully add the app id
            c.res.headers.set("X-bknd-id", this._id);
         } catch (e) {}

         await this.emgr.emit(
            new AppBeforeResponse({ app: this, request: c.req.raw, response: c.res }),
         );

         // execute collected async events (async by default)
         switch (this.options?.asyncEventsMode ?? "async") {
            case "sync":
               await this.emgr.executeAsyncs();
               break;
            case "async":
               this.emgr.executeAsyncs();
               break;
         }
      });

      // call server init if set
      if (this.options?.manager?.onServerInit) {
         this.options.manager.onServerInit(server);
      }

      await this.runPlugins("onServerInit", server);
   }

   protected async onModulesBuilt(ctx: ModuleBuildContext) {
      const results = (await this.runPlugins("schema")) as {
         name: string;
         result: ReturnType<typeof prototypeEm>;
      }[];
      if (results.length > 0) {
         for (const { name, result } of results) {
            if (result) {
               ctx.helper.ensureSchema(result);
               if (ctx.flags.sync_required) {
                  $console.log(`[Plugin:${name}] schema, sync required`);
               }
            }
         }
      }
      await this.options?.manager?.onModulesBuilt?.(ctx);
   }
}

export function createApp(config: CreateAppConfig = {}) {
   if (!config.connection || !Connection.isConnection(config.connection)) {
      throw new Error("Invalid connection");
   }

   return new App(config.connection, config.config, config.options);
}
