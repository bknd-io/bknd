import {
   d1Sqlite,
   getBinding,
   registerMedia,
   type CloudflareBkndConfig,
   type CloudflareEnv,
} from "bknd/adapter/cloudflare";
import type { GetPlatformProxyOptions, PlatformProxy } from "wrangler";
import process from "node:process";

export type WithPlatformProxyOptions = {
   /**
    * By default, proxy is used if the PROXY environment variable is set to 1.
    * You can override/force this by setting this option.
    */
   useProxy?: boolean;
   proxyOptions?: GetPlatformProxyOptions;
};

export function withPlatformProxy<Env extends CloudflareEnv>(
   config: CloudflareBkndConfig<Env> = {},
   opts?: WithPlatformProxyOptions,
) {
   const use_proxy =
      typeof opts?.useProxy === "boolean" ? opts.useProxy : process.env.PROXY === "1";
   let proxy: PlatformProxy | undefined;

   async function getEnv(env?: Env): Promise<Env> {
      if (use_proxy) {
         if (!proxy) {
            const getPlatformProxy = await import("wrangler").then((mod) => mod.getPlatformProxy);
            proxy = await getPlatformProxy(opts?.proxyOptions);
            process.on("exit", () => {
               proxy?.dispose();
            });
         }
         return proxy.env as unknown as Env;
      }
      return env || ({} as Env);
   }

   return {
      ...config,
      beforeBuild: async (app, registries) => {
         if (!use_proxy) return;
         const env = await getEnv();
         registerMedia(env, registries as any);
         await config?.beforeBuild?.(app, registries);
      },
      bindings: async (env) => {
         return (await config?.bindings?.(await getEnv(env))) || {};
      },
      // @ts-ignore
      app: async (_env) => {
         const env = await getEnv(_env);
         const binding = use_proxy ? getBinding(env, "D1Database") : undefined;

         if (config?.app === undefined && use_proxy && binding) {
            return {
               connection: d1Sqlite({
                  binding: binding.value,
               }),
            };
         } else if (typeof config?.app === "function") {
            const appConfig = await config?.app(env);
            if (binding) {
               appConfig.connection = d1Sqlite({
                  binding: binding.value,
               }) as any;
            }
            return appConfig;
         }
         return config?.app || {};
      },
   } satisfies CloudflareBkndConfig<Env>;
}
