import {
   objectEach,
   transformObject,
   McpServer,
   type s,
   SecretSchema,
   setPath,
   mark,
} from "bknd/utils";
import { DebugLogger } from "core/utils/DebugLogger";
import { Guard } from "auth/authorize/Guard";
import { env } from "core/env";
import { EventManager, Event } from "core/events";
import type { Connection } from "data/connection";
import { EntityManager } from "data/entities/EntityManager";
import { Hono } from "hono";
import type { ServerEnv } from "./Controller";
import { Module, type ModuleBuildContext } from "./Module";
import { ModuleHelper } from "./ModuleHelper";
import { AppServer } from "modules/server/AppServer";
import { AppAuth } from "auth/AppAuth";
import { AppData } from "data/AppData";
import { AppFlows } from "flows/AppFlows";
import { AppMedia } from "media/AppMedia";
import type { PartialRec } from "core/types";
import { mergeWith, pick } from "lodash-es";

export type { ModuleBuildContext };

export const MODULES = {
   server: AppServer,
   data: AppData,
   auth: AppAuth,
   media: AppMedia,
   flows: AppFlows,
} as const;

// get names of MODULES as an array
export const MODULE_NAMES = Object.keys(MODULES) as ModuleKey[];

export type ModuleKey = keyof typeof MODULES;
export type Modules = {
   [K in keyof typeof MODULES]: InstanceType<(typeof MODULES)[K]>;
};

export type ModuleSchemas = {
   [K in keyof typeof MODULES]: ReturnType<(typeof MODULES)[K]["prototype"]["getSchema"]>;
};

export type ModuleConfigs = {
   [K in keyof ModuleSchemas]: s.Static<ModuleSchemas[K]>;
};

export type InitialModuleConfigs = { version?: number } & PartialRec<ModuleConfigs>;

enum Verbosity {
   silent = 0,
   error = 1,
   log = 2,
}

export type ModuleManagerOptions = {
   initial?: InitialModuleConfigs;
   eventManager?: EventManager<any>;
   onUpdated?: <Module extends keyof Modules>(
      module: Module,
      config: ModuleConfigs[Module],
   ) => Promise<void>;
   // triggered when no config table existed
   onFirstBoot?: () => Promise<void>;
   // base path for the hono instance
   basePath?: string;
   // callback after server was created
   onServerInit?: (server: Hono<ServerEnv>) => void;
   // doesn't perform validity checks for given/fetched config
   skipValidation?: boolean;
   // runs when initial config provided on a fresh database
   seed?: (ctx: ModuleBuildContext) => Promise<void>;
   // called right after modules are built, before finish
   onModulesBuilt?: (ctx: ModuleBuildContext) => Promise<void>;
   // whether to store secrets in the database
   storeSecrets?: boolean;
   // provided secrets
   secrets?: Record<string, any>;
   /** @deprecated */
   verbosity?: Verbosity;
};

const debug_modules = env("modules_debug");

abstract class ModuleManagerEvent<A = {}> extends Event<{ ctx: ModuleBuildContext } & A> {}
export class ModuleManagerConfigUpdateEvent<
   Module extends keyof ModuleConfigs,
> extends ModuleManagerEvent<{
   module: Module;
   config: ModuleConfigs[Module];
}> {
   static override slug = "mm-config-update";
}
export class ModuleManagerSecretsExtractedEvent extends ModuleManagerEvent<{
   secrets: Record<string, any>;
}> {
   static override slug = "mm-secrets-extracted";
}
export const ModuleManagerEvents = {
   ModuleManagerConfigUpdateEvent,
   ModuleManagerSecretsExtractedEvent,
};

// @todo: cleanup old diffs on upgrade
// @todo: cleanup multiple backups on upgrade
export class ModuleManager {
   static Events = ModuleManagerEvents;

   protected modules: Modules;
   // ctx for modules
   em!: EntityManager;
   server!: Hono<ServerEnv>;
   emgr!: EventManager;
   guard!: Guard;
   mcp!: ModuleBuildContext["mcp"];

   protected _built = false;

   protected logger: DebugLogger;

   constructor(
      protected readonly connection: Connection,
      protected options?: Partial<ModuleManagerOptions>,
   ) {
      this.modules = {} as Modules;
      this.emgr = new EventManager({ ...ModuleManagerEvents });
      this.logger = new DebugLogger(debug_modules);

      const config = options?.initial ?? {};
      if (options?.skipValidation) {
         mark(config, true);
      }

      this.createModules(config);
   }

   protected onModuleConfigUpdated(key: string, config: any) {}

   private createModules(initial: PartialRec<ModuleConfigs>) {
      this.logger.context("createModules").log("creating modules");
      try {
         const context = this.ctx(true);

         for (const key in MODULES) {
            const moduleConfig = initial && key in initial ? initial[key] : {};
            const module = new MODULES[key](moduleConfig, context) as Module;
            module.setListener(async (c) => {
               await this.onModuleConfigUpdated(key, c);
            });

            this.modules[key] = module;
         }
         this.logger.log("modules created");
      } catch (e) {
         this.logger.log("failed to create modules", e);
         throw e;
      }
      this.logger.clear();
   }

   private get verbosity() {
      return this.options?.verbosity ?? Verbosity.silent;
   }

   isBuilt(): boolean {
      return this._built;
   }

   protected rebuildServer() {
      this.server = new Hono<ServerEnv>();
      if (this.options?.basePath) {
         this.server = this.server.basePath(this.options.basePath);
      }
      if (this.options?.onServerInit) {
         this.options.onServerInit(this.server);
      }

      // optional method for each module to register global middlewares, etc.
      objectEach(this.modules, (module) => {
         module.onServerInit(this.server);
      });
   }

   ctx(rebuild?: boolean): ModuleBuildContext {
      if (rebuild) {
         this.rebuildServer();
         this.em = this.em
            ? this.em.clear()
            : new EntityManager([], this.connection, [], [], this.emgr);
         this.guard = new Guard();
         this.mcp = new McpServer(undefined as any, {
            app: new Proxy(this, {
               get: () => {
                  throw new Error("app is not available in mcp context");
               },
            }) as any,
            ctx: () => this.ctx(),
         });
      }

      const ctx = {
         connection: this.connection,
         server: this.server,
         em: this.em,
         emgr: this.emgr,
         guard: this.guard,
         flags: Module.ctx_flags,
         logger: this.logger,
         mcp: this.mcp,
      };

      return {
         ...ctx,
         helper: new ModuleHelper(ctx),
      };
   }

   extractSecrets() {
      const moduleConfigs = structuredClone(this.configs());
      const secrets = { ...this.options?.secrets };
      const extractedKeys: string[] = [];

      for (const [key, module] of Object.entries(this.modules)) {
         const config = moduleConfigs[key];
         const schema = module.getSchema();

         const extracted = [...schema.walk({ data: config })].filter(
            (n) => n.schema instanceof SecretSchema,
         );

         for (const n of extracted) {
            const path = [key, ...n.instancePath].join(".");

            if (typeof n.data === "string") {
               extractedKeys.push(path);
               secrets[path] = n.data;
               setPath(moduleConfigs, path, "");
            }
         }
      }

      return {
         configs: moduleConfigs,
         secrets: pick(secrets, extractedKeys),
         extractedKeys,
      };
   }

   protected async setConfigs(configs: ModuleConfigs): Promise<void> {
      this.logger.log("setting configs");
      for await (const [key, config] of Object.entries(configs)) {
         if (!(key in this.modules)) continue;

         try {
            // setting "noEmit" to true, to not force listeners to update
            const result = await this.modules[key].schema().set(config as any, true);
         } catch (e) {
            console.error(e);
            throw new Error(
               `Failed to set config for module ${key}: ${JSON.stringify(config, null, 2)}`,
            );
         }
      }
   }

   async build(opts?: any) {
      this.createModules(this.options?.initial ?? {});
      await this.buildModules();

      // if secrets were provided, extract, merge and build again
      const provided_secrets = this.options?.secrets ?? {};
      if (Object.keys(provided_secrets).length > 0) {
         const { configs, extractedKeys } = this.extractSecrets();

         for (const key of extractedKeys) {
            if (key in provided_secrets) {
               setPath(configs, key, provided_secrets[key]);
            }
         }

         await this.setConfigs(configs);
         await this.buildModules();
      }

      return this;
   }

   protected async buildModules(options?: {
      graceful?: boolean;
      ignoreFlags?: boolean;
      drop?: boolean;
   }) {
      const state = {
         built: false,
         modules: [] as ModuleKey[],
         synced: false,
         saved: false,
         reloaded: false,
      };

      this.logger.context("buildModules").log("triggered", options, this._built);
      if (options?.graceful && this._built) {
         this.logger.log("skipping build (graceful)");
         return state;
      }

      this.logger.log("building");
      const ctx = this.ctx(true);
      for (const key in this.modules) {
         await this.modules[key].setContext(ctx).build();
         this.logger.log("built", key);
         state.modules.push(key as ModuleKey);
      }

      this._built = state.built = true;
      this.logger.log("modules built", ctx.flags);

      if (this.options?.onModulesBuilt) {
         await this.options.onModulesBuilt(ctx);
      }

      if (options?.ignoreFlags !== true) {
         if (ctx.flags.sync_required) {
            ctx.flags.sync_required = false;
            this.logger.log("db sync requested");

            // sync db
            await ctx.em.schema().sync({ force: true, drop: options?.drop });
            state.synced = true;
         }

         if (ctx.flags.ctx_reload_required) {
            ctx.flags.ctx_reload_required = false;
            this.logger.log("ctx reload requested");
            this.ctx(true);
            state.reloaded = true;
         }
      }

      // reset all falgs
      this.logger.log("resetting flags");
      ctx.flags = Module.ctx_flags;

      // storing last stable config version
      //this._stable_configs = $diff.clone(this.configs());

      this.logger.clear();
      return state;
   }

   get<K extends keyof Modules>(key: K): Modules[K] {
      if (!(key in this.modules)) {
         throw new Error(`Module "${key}" doesn't exist, cannot get`);
      }
      return this.modules[key];
   }

   version() {
      return 0;
   }

   built() {
      return this._built;
   }

   configs(): ModuleConfigs {
      return transformObject(this.modules, (module) => module.toJSON(true)) as any;
   }

   getSchema() {
      const schemas = transformObject(this.modules, (module) => module.getSchema());

      return {
         version: this.version(),
         ...schemas,
      } as { version: number } & ModuleSchemas;
   }

   toJSON(secrets?: boolean): { version: number } & ModuleConfigs {
      const modules = transformObject(this.modules, (module) => {
         if (this._built) {
            return module.isBuilt() ? module.toJSON(secrets) : module.configDefault;
         }

         // returns no config if the all modules are not built
         return undefined;
      });

      return {
         version: this.version(),
         ...modules,
      } as any;
   }
}

export function getDefaultSchema() {
   const schema = {
      type: "object",
      ...transformObject(MODULES, (module) => module.prototype.getSchema()),
   };

   return schema as any;
}

export function getDefaultConfig(): ModuleConfigs {
   const config = transformObject(MODULES, (module) => {
      return module.prototype.getSchema().template(
         {},
         {
            withOptional: true,
            withExtendedOptional: true,
         },
      );
   });

   return structuredClone(config) as any;
}
