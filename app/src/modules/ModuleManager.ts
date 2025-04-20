import { Guard } from "auth";
import { $console, BkndError, DebugLogger, env } from "core";
import { EventManager } from "core/events";
import * as $diff from "core/object/diff";
import {
   Default,
   type Static,
   StringEnum,
   mark,
   objectEach,
   stripMark,
   transformObject,
} from "core/utils";
import {
   type Connection,
   EntityManager,
   type Schema,
   datetime,
   entity,
   enumm,
   jsonSchema,
   number,
} from "data";
import { TransformPersistFailedException } from "data/errors";
import { Hono } from "hono";
import type { Kysely } from "kysely";
import { mergeWith } from "lodash-es";
import { CURRENT_VERSION, TABLE_NAME, migrate } from "modules/migrations";
import { AppServer } from "modules/server/AppServer";
import { AppAuth } from "../auth/AppAuth";
import { AppData } from "../data/AppData";
import { AppFlows } from "../flows/AppFlows";
import { AppMedia } from "../media/AppMedia";
import type { ServerEnv } from "./Controller";
import { Module, type ModuleBuildContext } from "./Module";
import * as tbbox from "@sinclair/typebox";
const { Type } = tbbox;

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
   [K in keyof ModuleSchemas]: Static<ModuleSchemas[K]>;
};
type PartialRec<T> = { [P in keyof T]?: PartialRec<T[P]> };

export type InitialModuleConfigs =
   | ({
        version: number;
     } & ModuleConfigs)
   | PartialRec<ModuleConfigs>;

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
   trustFetched?: boolean;
   // runs when initial config provided on a fresh database
   seed?: (ctx: ModuleBuildContext) => Promise<void>;
   /** @deprecated */
   verbosity?: Verbosity;
};

export type ConfigTable<Json = ModuleConfigs> = {
   id?: number;
   version: number;
   type: "config" | "diff" | "backup";
   json: Json;
   created_at?: Date;
   updated_at?: Date;
};

const configJsonSchema = Type.Union([
   getDefaultSchema(),
   Type.Array(
      Type.Object({
         t: StringEnum(["a", "r", "e"]),
         p: Type.Array(Type.Union([Type.String(), Type.Number()])),
         o: Type.Optional(Type.Any()),
         n: Type.Optional(Type.Any()),
      }),
   ),
]);
export const __bknd = entity(TABLE_NAME, {
   version: number().required(),
   type: enumm({ enum: ["config", "diff", "backup"] }).required(),
   json: jsonSchema({ schema: configJsonSchema }).required(),
   created_at: datetime(),
   updated_at: datetime(),
});
type ConfigTable2 = Schema<typeof __bknd>;
interface T_INTERNAL_EM {
   __bknd: ConfigTable2;
}

const debug_modules = env("modules_debug");

// @todo: cleanup old diffs on upgrade
// @todo: cleanup multiple backups on upgrade
export class ModuleManager {
   protected modules: Modules;
   // internal em for __bknd config table
   __em!: EntityManager<T_INTERNAL_EM>;
   // ctx for modules
   em!: EntityManager;
   server!: Hono<ServerEnv>;
   emgr!: EventManager;
   guard!: Guard;

   private _version: number = 0;
   private _built = false;
   private readonly _booted_with?: "provided" | "partial";
   private _stable_configs: ModuleConfigs | undefined;

   private logger: DebugLogger;

   constructor(
      private readonly connection: Connection,
      private options?: Partial<ModuleManagerOptions>,
   ) {
      this.__em = new EntityManager([__bknd], this.connection);
      this.modules = {} as Modules;
      this.emgr = new EventManager();
      this.logger = new DebugLogger(debug_modules);
      let initial = {} as Partial<ModuleConfigs>;

      if (options?.initial) {
         if ("version" in options.initial) {
            const { version, ...initialConfig } = options.initial;
            this._version = version;
            initial = stripMark(initialConfig);

            this._booted_with = "provided";
         } else {
            initial = mergeWith(getDefaultConfig(), options.initial);
            this._booted_with = "partial";
         }
      }

      this.logger.log("booted with", this._booted_with);

      this.createModules(initial);
   }

   private createModules(initial: Partial<ModuleConfigs>) {
      this.logger.context("createModules").log("creating modules");
      try {
         const context = this.ctx(true);

         for (const key in MODULES) {
            const moduleConfig = key in initial ? initial[key] : {};
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

   /**
    * This is set through module's setListener
    * It's called everytime a module's config is updated in SchemaObject
    * Needs to rebuild modules and save to database
    */
   private async onModuleConfigUpdated(key: string, config: any) {
      if (this.options?.onUpdated) {
         await this.options.onUpdated(key as any, config);
      } else {
         await this.buildModules();
      }
   }

   private repo() {
      return this.__em.repo(__bknd, {
         // to prevent exceptions when table doesn't exist
         silent: true,
         // disable counts for performance and compatibility
         includeCounts: false,
      });
   }

   private mutator() {
      return this.__em.mutator(__bknd);
   }

   private get db() {
      return this.connection.kysely as Kysely<{ table: ConfigTable }>;
   }

   // @todo: add indices for: version, type
   async syncConfigTable() {
      this.logger.context("sync").log("start");
      const result = await this.__em.schema().sync({ force: true });
      this.logger.log("done").clear();
      return result;
   }

   private rebuildServer() {
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
         this.em = new EntityManager([], this.connection, [], [], this.emgr);
         this.guard = new Guard();
      }

      return {
         connection: this.connection,
         server: this.server,
         em: this.em,
         emgr: this.emgr,
         guard: this.guard,
         flags: Module.ctx_flags,
         logger: this.logger,
      };
   }

   private async fetch(): Promise<ConfigTable | undefined> {
      this.logger.context("fetch").log("fetching");
      const startTime = performance.now();

      // disabling console log, because the table might not exist yet
      const { data: result } = await this.repo().findOne(
         { type: "config" },
         {
            sort: { by: "version", dir: "desc" },
         },
      );

      if (!result) {
         this.logger.log("error fetching").clear();
         return undefined;
      }

      this.logger
         .log("took", performance.now() - startTime, "ms", {
            version: result.version,
            id: result.id,
         })
         .clear();

      return result as unknown as ConfigTable;
   }

   async save() {
      this.logger.context("save").log("saving version", this.version());
      const configs = this.configs();
      const version = this.version();

      try {
         const state = await this.fetch();
         if (!state) throw new BkndError("no config found");
         this.logger.log("fetched version", state.version);

         if (state.version !== version) {
            // @todo: mark all others as "backup"
            this.logger.log("version conflict, storing new version", state.version, version);
            await this.mutator().insertOne({
               version: state.version,
               type: "backup",
               json: configs,
            });
            await this.mutator().insertOne({
               version: version,
               type: "config",
               json: configs,
            });
         } else {
            this.logger.log("version matches", state.version);

            // clean configs because of Diff() function
            const diffs = $diff.diff(state.json, $diff.clone(configs));
            this.logger.log("checking diff", [diffs.length]);

            if (diffs.length > 0) {
               // validate diffs, it'll throw on invalid
               this.validateDiffs(diffs);

               const date = new Date();
               // store diff
               await this.mutator().insertOne({
                  version,
                  type: "diff",
                  json: $diff.clone(diffs),
                  created_at: date,
                  updated_at: date,
               });

               // store new version
               await this.mutator().updateWhere(
                  {
                     version,
                     json: configs,
                     updated_at: date,
                  } as any,
                  {
                     type: "config",
                     version,
                  },
               );
            } else {
               this.logger.log("no diff, not saving");
            }
         }
      } catch (e) {
         if (e instanceof BkndError && e.message === "no config found") {
            this.logger.log("no config, just save fresh");
            // no config, just save
            await this.mutator().insertOne({
               type: "config",
               version,
               json: configs,
               created_at: new Date(),
               updated_at: new Date(),
            });
         } else if (e instanceof TransformPersistFailedException) {
            $console.error("ModuleManager: Cannot save invalid config");
            this.revertModules();
            throw e;
         } else {
            $console.error("ModuleManager: Aborting");
            this.revertModules();
            throw e;
         }
      }

      // re-apply configs to all modules (important for system entities)
      this.setConfigs(configs);

      // @todo: cleanup old versions?

      this.logger.clear();
      return this;
   }

   private revertModules() {
      if (this._stable_configs) {
         $console.warn("ModuleManager: Reverting modules");
         this.setConfigs(this._stable_configs as any);
      } else {
         $console.error("ModuleManager: No stable configs to revert to");
      }
   }

   /**
    * Validates received diffs for an additional security control.
    * Checks:
    *   - check if module is registered
    *   - run modules onBeforeUpdate() for added protection
    *
    * **Important**: Throw `Error` so it won't get catched.
    *
    * @param diffs
    * @private
    */
   private validateDiffs(diffs: $diff.DiffEntry[]): void {
      // check top level paths, and only allow a single module to be modified in a single transaction
      const modules = [...new Set(diffs.map((d) => d.p[0]))];
      if (modules.length === 0) {
         return;
      }

      for (const moduleName of modules) {
         const name = moduleName as ModuleKey;
         const module = this.get(name) as Module;
         if (!module) {
            const msg = "validateDiffs: module not registered";
            // biome-ignore format: ...
            $console.error(msg, JSON.stringify({ module: name, diffs }, null, 2));
            throw new Error(msg);
         }

         // pass diffs to the module to allow it to throw
         if (this._stable_configs?.[name]) {
            const current = $diff.clone(this._stable_configs?.[name]);
            const modified = $diff.apply({ [name]: current }, diffs)[name];
            module.onBeforeUpdate(current, modified);
         }
      }
   }

   private setConfigs(configs: ModuleConfigs): void {
      this.logger.log("setting configs");
      objectEach(configs, (config, key) => {
         try {
            // setting "noEmit" to true, to not force listeners to update
            this.modules[key].schema().set(config as any, true);
         } catch (e) {
            console.error(e);
            throw new Error(
               `Failed to set config for module ${key}: ${JSON.stringify(config, null, 2)}`,
            );
         }
      });
   }

   async build(opts?: { fetch?: boolean }) {
      this.logger.context("build").log("version", this.version());
      await this.ctx().connection.init();

      // if no config provided, try fetch from db
      if (this.version() === 0 || opts?.fetch === true) {
         if (opts?.fetch) {
            this.logger.log("force fetch");
         }

         const result = await this.fetch();

         // if no version, and nothing found, go with initial
         if (!result) {
            this.logger.log("nothing in database, go initial");
            await this.setupInitial();
         } else {
            this.logger.log("db has", result.version);
            // set version and config from fetched
            this._version = result.version;

            if (this.options?.trustFetched === true) {
               this.logger.log("trusting fetched config (mark)");
               mark(result.json);
            }

            // if version doesn't match, migrate before building
            if (this.version() !== CURRENT_VERSION) {
               this.logger.log("now migrating");

               await this.syncConfigTable();

               const version_before = this.version();
               const [_version, _configs] = await migrate(version_before, result.json, {
                  db: this.db,
               });

               this._version = _version;
               this.ctx().flags.sync_required = true;

               this.logger.log("migrated to", _version);
               $console.log("Migrated config from", version_before, "to", this.version());

               this.createModules(_configs);
               await this.buildModules();
            } else {
               this.logger.log("version is current", this.version());
               this.createModules(result.json);
               await this.buildModules();
            }
         }
      } else {
         if (this.version() !== CURRENT_VERSION) {
            throw new Error(
               `Given version (${this.version()}) and current version (${CURRENT_VERSION}) do not match.`,
            );
         }
         this.logger.log("current version is up to date", this.version());
         await this.buildModules();
      }

      this.logger.log("done");
      this.logger.clear();
      return this;
   }

   private async buildModules(options?: { graceful?: boolean; ignoreFlags?: boolean }) {
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

      if (options?.ignoreFlags !== true) {
         if (ctx.flags.sync_required) {
            ctx.flags.sync_required = false;
            this.logger.log("db sync requested");

            // sync db
            await ctx.em.schema().sync({ force: true });
            state.synced = true;

            // save
            await this.save();
            state.saved = true;
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
      this._stable_configs = $diff.clone(this.configs());

      this.logger.clear();
      return state;
   }

   protected async setupInitial() {
      this.logger.context("initial").log("start");
      this._version = CURRENT_VERSION;
      await this.syncConfigTable();
      const state = await this.buildModules();
      if (!state.saved) {
         await this.save();
      }

      const ctx = {
         ...this.ctx(),
         // disable events for initial setup
         em: this.ctx().em.fork(),
      };

      // perform a sync
      await ctx.em.schema().sync({ force: true });
      await this.options?.seed?.(ctx);

      // run first boot event
      await this.options?.onFirstBoot?.();
      this.logger.clear();
   }

   mutateConfigSafe<Module extends keyof Modules>(
      name: Module,
   ): Pick<ReturnType<Modules[Module]["schema"]>, "set" | "patch" | "overwrite" | "remove"> {
      const module = this.modules[name];

      return new Proxy(module.schema(), {
         get: (target, prop: string) => {
            if (!["set", "patch", "overwrite", "remove"].includes(prop)) {
               throw new Error(`Method ${prop} is not allowed`);
            }

            return async (...args) => {
               $console.log("[Safe Mutate]", name);
               try {
                  // overwrite listener to run build inside this try/catch
                  module.setListener(async () => {
                     await this.buildModules();
                  });

                  const result = await target[prop](...args);

                  // revert to original listener
                  module.setListener(async (c) => {
                     await this.onModuleConfigUpdated(name, c);
                  });

                  // if there was an onUpdated listener, call it after success
                  // e.g. App uses it to register module routes
                  if (this.options?.onUpdated) {
                     await this.options.onUpdated(name, module.config as any);
                  }

                  return result;
               } catch (e) {
                  $console.error(`[Safe Mutate] failed "${name}":`, String(e));

                  // revert to previous config & rebuild using original listener
                  this.revertModules();
                  await this.onModuleConfigUpdated(name, module.config as any);
                  $console.warn(`[Safe Mutate] reverted "${name}":`);

                  // make sure to throw the error
                  throw e;
               }
            };
         },
      });
   }

   get<K extends keyof Modules>(key: K): Modules[K] {
      if (!(key in this.modules)) {
         throw new Error(`Module "${key}" doesn't exist, cannot get`);
      }
      return this.modules[key];
   }

   version() {
      return this._version;
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
      };
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
      return Default(module.prototype.getSchema(), {});
   });

   return config as any;
}
