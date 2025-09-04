import { mark, stripMark, $console, s } from "bknd/utils";
import { BkndError } from "core/errors";
import * as $diff from "core/object/diff";
import type { Connection } from "data/connection";
import { EntityManager } from "data/entities/EntityManager";
import * as proto from "data/prototype";
import { TransformPersistFailedException } from "data/errors";
import type { Kysely } from "kysely";
import { mergeWith } from "lodash-es";
import { CURRENT_VERSION, TABLE_NAME, migrate } from "modules/migrations";
import { Module, type ModuleBuildContext } from "../Module";
import {
   type InitialModuleConfigs,
   type ModuleConfigs,
   type Modules,
   type ModuleKey,
   getDefaultSchema,
   getDefaultConfig,
   ModuleManager,
   ModuleManagerConfigUpdateEvent,
   type ModuleManagerOptions,
} from "./ModuleManager";

export type { ModuleBuildContext };

export type ConfigTable<Json = ModuleConfigs> = {
   id?: number;
   version: number;
   type: "config" | "diff" | "backup";
   json: Json;
   created_at?: Date;
   updated_at?: Date;
};

const configJsonSchema = s.anyOf([
   getDefaultSchema(),
   s.array(
      s.strictObject({
         t: s.string({ enum: ["a", "r", "e"] }),
         p: s.array(s.anyOf([s.string(), s.number()])),
         o: s.any().optional(),
         n: s.any().optional(),
      }),
   ),
]);
export const __bknd = proto.entity(TABLE_NAME, {
   version: proto.number().required(),
   type: proto.enumm({ enum: ["config", "diff", "backup"] }).required(),
   json: proto.jsonSchema({ schema: configJsonSchema.toJSON() }).required(),
   created_at: proto.datetime(),
   updated_at: proto.datetime(),
});
type ConfigTable2 = proto.Schema<typeof __bknd>;
interface T_INTERNAL_EM {
   __bknd: ConfigTable2;
}

// @todo: cleanup old diffs on upgrade
// @todo: cleanup multiple backups on upgrade
export class DbModuleManager extends ModuleManager {
   // internal em for __bknd config table
   __em!: EntityManager<T_INTERNAL_EM>;

   private _version: number = 0;
   private readonly _booted_with?: "provided" | "partial";
   private _stable_configs: ModuleConfigs | undefined;

   constructor(connection: Connection, options?: Partial<ModuleManagerOptions>) {
      let initial = {} as InitialModuleConfigs;
      let booted_with = "partial" as any;
      let version = 0;

      if (options?.initial) {
         if ("version" in options.initial && options.initial.version) {
            const { version: _v, ...config } = options.initial;
            version = _v as number;
            initial = stripMark(config) as any;

            booted_with = "provided";
         } else {
            initial = mergeWith(getDefaultConfig(), options.initial);
            booted_with = "partial";
         }
      }

      super(connection, { ...options, initial });

      this.__em = new EntityManager([__bknd], this.connection);
      this._version = version;
      this._booted_with = booted_with;

      this.logger.log("booted with", this._booted_with);
   }

   /**
    * This is set through module's setListener
    * It's called everytime a module's config is updated in SchemaObject
    * Needs to rebuild modules and save to database
    */
   protected override async onModuleConfigUpdated(key: string, config: any) {
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
      // @todo: check why this is neccessary
      return this.connection.kysely as unknown as Kysely<{ table: ConfigTable }>;
   }

   // @todo: add indices for: version, type
   async syncConfigTable() {
      this.logger.context("sync").log("start");
      const result = await this.__em.schema().sync({ force: true });
      this.logger.log("done").clear();
      return result;
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
      await this.setConfigs(configs);

      // @todo: cleanup old versions?

      this.logger.clear();
      return this;
   }

   private async revertModules() {
      if (this._stable_configs) {
         $console.warn("ModuleManager: Reverting modules");
         await this.setConfigs(this._stable_configs as any);
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

   override async build(opts?: { fetch?: boolean }) {
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

               // @ts-expect-error
               await this.setConfigs(_configs);
               await this.buildModules();
            } else {
               this.logger.log("version is current", this.version());

               await this.setConfigs(result.json);
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

   protected override async buildModules(options?: { graceful?: boolean; ignoreFlags?: boolean }) {
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
                     await this.emgr.emit(
                        new ModuleManagerConfigUpdateEvent({
                           ctx: this.ctx(),
                           module: name,
                           config: module.config as any,
                        }),
                     );
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
                  $console.error(`[Safe Mutate] failed "${name}":`, e);

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

   override version() {
      return this._version;
   }
}
