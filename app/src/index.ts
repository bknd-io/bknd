try {
   /**
    * Adding this to avoid warnings from node:sqlite being experimental
    */
   const { emitWarning } = process;
   process.emitWarning = (warning: string, ...args: any[]) => {
      if (warning.includes("SQLite is an experimental feature")) return;
      return emitWarning(warning, ...args);
   };
} catch (e) {}

export {
   App,
   createApp,
   AppEvents,
   type AppConfig,
   type CreateAppConfig,
   type AppPlugin,
   type LocalApiOptions,
} from "./App";

export {
   getDefaultConfig,
   getDefaultSchema,
   type ModuleConfigs,
   type ModuleSchemas,
   type ModuleManagerOptions,
   type ModuleBuildContext,
   type InitialModuleConfigs,
   ModuleManagerEvents,
} from "./modules/ModuleManager";

export type { ServerEnv } from "modules/Controller";
export type { BkndConfig } from "bknd/adapter";

export * as middlewares from "modules/middlewares";
export { registries } from "modules/registries";

export type { MediaFieldSchema } from "media/AppMedia";
export type { UserFieldSchema } from "auth/AppAuth";
