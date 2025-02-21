import { Api, type ApiOptions } from "Api";
import type { CreateUserPayload } from "auth/AppAuth";
import { $console } from "core";
import { Event } from "core/events";
import { Connection, type LibSqlCredentials, LibsqlConnection } from "data";
import type { Hono } from "hono";
import {
   type InitialModuleConfigs,
   type ModuleBuildContext,
   ModuleManager,
   type ModuleManagerOptions,
   type Modules
} from "modules/ModuleManager";
import * as SystemPermissions from "modules/permissions";
import { AdminController, type AdminControllerOptions } from "modules/server/AdminController";
import { SystemController } from "modules/server/SystemController";

export type AppPlugin = (app: App) => Promise<void> | void;

abstract class AppEvent<A = {}> extends Event<{ app: App } & A> {}
export class AppConfigUpdatedEvent extends AppEvent {
   static override slug = "app-config-updated";
}
export class AppBuiltEvent extends AppEvent {
   static override slug = "app-built";
}
export class AppFirstBoot extends AppEvent {
   static override slug = "app-first-boot";
}
export const AppEvents = { AppConfigUpdatedEvent, AppBuiltEvent, AppFirstBoot } as const;

export type AppOptions = {
   plugins?: AppPlugin[];
   seed?: (ctx: ModuleBuildContext) => Promise<void>;
   manager?: Omit<ModuleManagerOptions, "initial" | "onUpdated" | "seed">;
};
export type CreateAppConfig = {
   connection?:
      | Connection
      | {
           // @deprecated
           type: "libsql";
           config: LibSqlCredentials;
        }
      | LibSqlCredentials;
   initialConfig?: InitialModuleConfigs;
   options?: AppOptions;
};

export type AppConfig = InitialModuleConfigs;
export type LocalApiOptions = Request | ApiOptions;

export class App {
   modules: ModuleManager;
   static readonly Events = AppEvents;
   adminController?: AdminController;
   private trigger_first_boot = false;
   private plugins: AppPlugin[];

   constructor(
      private connection: Connection,
      _initialConfig?: InitialModuleConfigs,
      private options?: AppOptions
   ) {
      this.plugins = options?.plugins ?? [];
      this.modules = new ModuleManager(connection, {
         ...(options?.manager ?? {}),
         initial: _initialConfig,
         seed: options?.seed,
         onUpdated: async (key, config) => {
            // if the EventManager was disabled, we assume we shouldn't
            // respond to events, such as "onUpdated".
            // this is important if multiple changes are done, and then build() is called manually
            if (!this.emgr.enabled) {
               $console.warn("App config updated, but event manager is disabled, skip.");
               return;
            }

            $console.log("App config updated", key);
            // @todo: potentially double syncing
            await this.build({ sync: true });
            await this.emgr.emit(new AppConfigUpdatedEvent({ app: this }));
         },
         onFirstBoot: async () => {
            $console.log("App first boot");
            this.trigger_first_boot = true;
         },
         onServerInit: async (server) => {
            server.use(async (c, next) => {
               c.set("app", this);
               await next();
            });
         }
      });
      this.modules.ctx().emgr.registerEvents(AppEvents);
   }

   get emgr() {
      return this.modules.ctx().emgr;
   }

   async build(options?: { sync?: boolean }) {
      if (options?.sync) this.modules.ctx().flags.sync_required = true;
      await this.modules.build();

      const { guard, server } = this.modules.ctx();

      // load system controller
      guard.registerPermissions(Object.values(SystemPermissions));
      server.route("/api/system", new SystemController(this).getController());

      // load plugins
      if (this.plugins.length > 0) {
         await Promise.all(this.plugins.map((plugin) => plugin(this)));
      }

      await this.emgr.emit(new AppBuiltEvent({ app: this }));

      // first boot is set from ModuleManager when there wasn't a config table
      if (this.trigger_first_boot) {
         this.trigger_first_boot = false;
         await this.emgr.emit(new AppFirstBoot({ app: this }));
      }
   }

   mutateConfig<Module extends keyof Modules>(module: Module) {
      return this.modules.mutateConfigSafe(module);
   }

   get server() {
      return this.modules.server;
   }

   get em() {
      return this.modules.ctx().em;
   }

   get fetch(): Hono["fetch"] {
      return this.server.fetch;
   }

   get module() {
      return new Proxy(
         {},
         {
            get: (_, module: keyof Modules) => {
               return this.modules.get(module);
            }
         }
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
      this.modules.server.route(config?.basepath ?? "/", this.adminController.getController());
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

   async getApi(options?: LocalApiOptions) {
      const fetcher = this.server.request as typeof fetch;
      if (options && options instanceof Request) {
         const api = new Api({ request: options, headers: options.headers, fetcher });
         await api.verifyAuth();
         return api;
      }

      return new Api({ host: "http://localhost", ...(options ?? {}), fetcher });
   }
}

export function createApp(config: CreateAppConfig = {}) {
   let connection: Connection | undefined = undefined;

   try {
      if (Connection.isConnection(config.connection)) {
         connection = config.connection;
      } else if (typeof config.connection === "object") {
         if ("type" in config.connection) {
            $console.warn(
               "Using deprecated connection type 'libsql', use the 'config' object directly."
            );
            connection = new LibsqlConnection(config.connection.config);
         } else {
            connection = new LibsqlConnection(config.connection);
         }
      } else {
         connection = new LibsqlConnection({ url: ":memory:" });
         $console.warn("No connection provided, using in-memory database");
      }
   } catch (e) {
      $console.error("Could not create connection", e);
   }

   if (!connection) {
      throw new Error("Invalid connection");
   }

   return new App(connection, config.initialConfig, config.options);
}
