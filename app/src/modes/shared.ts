import type { AppPlugin, BkndConfig, MaybePromise, Merge } from "bknd";
import { syncTypes, syncConfig } from "bknd/plugins";
import { syncSecrets } from "plugins/dev/sync-secrets.plugin";
import { invariant, $console } from "bknd/utils";

export type BkndModeOptions = {
   /**
    * Whether the application is running in production.
    */
   isProduction?: boolean;
   /**
    * Writer function to write the configuration to the file system
    */
   writer?: (path: string, content: string) => MaybePromise<void>;
   /**
    * Configuration file path
    */
   configFilePath?: string;
   /**
    * Types file path
    * @default "bknd-types.d.ts"
    */
   typesFilePath?: string;
   /**
    * Syncing secrets options
    */
   syncSecrets?: {
      /**
       * Whether to enable syncing secrets
       */
      enabled?: boolean;
      /**
       * Output file path
       */
      outFile?: string;
      /**
       * Format of the output file
       * @default "env"
       */
      format?: "json" | "env";
      /**
       * Whether to include secrets in the output file
       * @default false
       */
      includeSecrets?: boolean;
   };
   /**
    * Determines whether to automatically sync the schema if not in production.
    * @default true
    */
   syncSchema?: boolean | { force?: boolean; drop?: boolean };
};

export type BkndModeConfig<Args = any, Additional = {}> = BkndConfig<
   Args,
   Merge<BkndModeOptions & Additional>
>;

export async function makeModeConfig<
   Args = any,
   Config extends BkndModeConfig<Args> = BkndModeConfig<Args>,
>({ app, ..._config }: Config, args: Args) {
   const appConfig = typeof app === "function" ? await app(args) : app;

   const config = {
      ..._config,
      ...appConfig,
   } as Omit<Config, "app">;

   if (typeof config.isProduction !== "boolean") {
      $console.warn(
         "You should set `isProduction` option when using managed modes to prevent accidental issues",
      );
   }

   invariant(
      typeof config.writer === "function",
      "You must set the `writer` option when using managed modes",
   );

   const { typesFilePath, configFilePath, writer, syncSecrets: syncSecretsOptions } = config;

   const isProd = config.isProduction;
   const plugins = appConfig?.options?.plugins ?? ([] as AppPlugin[]);
   const syncSchemaOptions =
      typeof config.syncSchema === "object"
         ? config.syncSchema
         : {
              force: config.syncSchema !== false,
              drop: true,
           };

   if (!isProd) {
      if (typesFilePath) {
         if (plugins.some((p) => p.name === "bknd-sync-types")) {
            throw new Error("You have to unregister the `syncTypes` plugin");
         }
         plugins.push(
            syncTypes({
               enabled: true,
               includeFirstBoot: true,
               write: async (et) => {
                  try {
                     await config.writer?.(typesFilePath, et.toString());
                  } catch (e) {
                     console.error(`Error writing types to"${typesFilePath}"`, e);
                  }
               },
            }) as any,
         );
      }

      if (configFilePath) {
         if (plugins.some((p) => p.name === "bknd-sync-config")) {
            throw new Error("You have to unregister the `syncConfig` plugin");
         }
         plugins.push(
            syncConfig({
               enabled: true,
               includeFirstBoot: true,
               write: async (config) => {
                  try {
                     await writer?.(configFilePath, JSON.stringify(config, null, 2));
                  } catch (e) {
                     console.error(`Error writing config to "${configFilePath}"`, e);
                  }
               },
            }) as any,
         );
      }

      if (syncSecretsOptions?.enabled) {
         if (plugins.some((p) => p.name === "bknd-sync-secrets")) {
            throw new Error("You have to unregister the `syncSecrets` plugin");
         }

         let outFile = syncSecretsOptions.outFile;
         const format = syncSecretsOptions.format ?? "env";
         if (!outFile) {
            outFile = ["env", !syncSecretsOptions.includeSecrets && "example", format]
               .filter(Boolean)
               .join(".");
         }

         plugins.push(
            syncSecrets({
               enabled: true,
               includeFirstBoot: true,
               write: async (secrets) => {
                  const values = Object.fromEntries(
                     Object.entries(secrets).map(([key, value]) => [
                        key,
                        syncSecretsOptions.includeSecrets ? value : "",
                     ]),
                  );

                  try {
                     if (format === "env") {
                        await writer?.(
                           outFile,
                           Object.entries(values)
                              .map(([key, value]) => `${key}=${value}`)
                              .join("\n"),
                        );
                     } else {
                        await writer?.(outFile, JSON.stringify(values, null, 2));
                     }
                  } catch (e) {
                     console.error(`Error writing secrets to "${outFile}"`, e);
                  }
               },
            }) as any,
         );
      }
   }

   return {
      config,
      isProd,
      plugins,
      syncSchemaOptions,
   };
}
