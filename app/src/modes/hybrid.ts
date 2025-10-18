import type { BkndConfig } from "bknd/adapter";
import { makeModeConfig, type BkndModeConfig } from "./shared";
import { getDefaultConfig, type MaybePromise, type ModuleConfigs, type Merge } from "bknd";
import type { DbModuleManager } from "modules/db/DbModuleManager";
import { invariant, $console } from "bknd/utils";

export type BkndHybridModeOptions = {
   /**
    * Reader function to read the configuration from the file system.
    * This is required for hybrid mode to work.
    */
   reader?: (path: string) => MaybePromise<string>;
   /**
    * Provided secrets to be merged into the configuration
    */
   secrets?: Record<string, any>;
};

export type HybridBkndConfig<Args = any> = BkndModeConfig<Args, BkndHybridModeOptions>;
export type HybridMode<AdapterConfig extends BkndConfig> = AdapterConfig extends BkndConfig<
   infer Args
>
   ? BkndModeConfig<Args, Merge<BkndHybridModeOptions & AdapterConfig>>
   : never;

export function hybrid<Args>({
   configFilePath = "bknd-config.json",
   ...rest
}: HybridBkndConfig<Args>): BkndConfig<Args> {
   return {
      ...rest,
      config: undefined,
      app: async (args) => {
         const {
            config: appConfig,
            isProd,
            plugins,
            syncSchemaOptions,
         } = await makeModeConfig(
            {
               ...rest,
               configFilePath,
            },
            args,
         );

         if (appConfig?.options?.mode && appConfig?.options?.mode !== "db") {
            $console.warn("You should not set a different mode than `db` when using hybrid mode");
         }
         invariant(
            typeof appConfig.reader === "function",
            "You must set the `reader` option when using hybrid mode",
         );

         let fileConfig: ModuleConfigs;
         try {
            fileConfig = JSON.parse(await appConfig.reader!(configFilePath)) as ModuleConfigs;
         } catch (e) {
            const defaultConfig = (appConfig.config ?? getDefaultConfig()) as ModuleConfigs;
            await appConfig.writer!(configFilePath, JSON.stringify(defaultConfig, null, 2));
            fileConfig = defaultConfig;
         }

         return {
            ...(appConfig as any),
            beforeBuild: async (app) => {
               if (app && !isProd) {
                  const mm = app.modules as DbModuleManager;
                  mm.buildSyncConfig = syncSchemaOptions;
               }
            },
            config: fileConfig,
            options: {
               ...appConfig?.options,
               mode: isProd ? "code" : "db",
               plugins,
               manager: {
                  // skip validation in prod for a speed boost
                  skipValidation: isProd,
                  // secrets are required for hybrid mode
                  secrets: appConfig.secrets,
                  ...appConfig?.options?.manager,
               },
            },
         };
      },
   };
}
