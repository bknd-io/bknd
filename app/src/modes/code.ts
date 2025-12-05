import type { BkndConfig } from "bknd/adapter";
import { makeModeConfig, type BkndModeConfig } from "./shared";
import { $console } from "bknd/utils";

export type BkndCodeModeConfig<Args = any> = BkndModeConfig<Args>;

export type CodeMode<AdapterConfig extends BkndConfig> = AdapterConfig extends BkndConfig<
   infer Args
>
   ? BkndModeConfig<Args, AdapterConfig>
   : never;

export function code<
   Config extends BkndConfig,
   Args = Config extends BkndConfig<infer A> ? A : unknown,
>(codeConfig: CodeMode<Config>): BkndConfig<Args> {
   return {
      ...codeConfig,
      app: async (args) => {
         const {
            config: appConfig,
            plugins,
            isProd,
            syncSchemaOptions,
         } = await makeModeConfig(codeConfig, args);

         if (appConfig?.options?.mode && appConfig?.options?.mode !== "code") {
            $console.warn("You should not set a different mode than `db` when using code mode");
         }

         return {
            ...appConfig,
            options: {
               ...appConfig?.options,
               mode: "code",
               plugins,
               manager: {
                  // skip validation in prod for a speed boost
                  skipValidation: isProd,
                  onModulesBuilt: async (ctx) => {
                     if (!isProd && syncSchemaOptions.force) {
                        $console.log("[code] syncing schema");
                        await ctx.em.schema().sync(syncSchemaOptions);
                     }
                  },
                  ...appConfig?.options?.manager,
               },
            },
         };
      },
   };
}
