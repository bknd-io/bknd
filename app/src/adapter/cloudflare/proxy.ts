import {
   d1Sqlite,
   getBinding,
   registerMedia,
   type CloudflareBkndConfig,
   type CloudflareEnv,
} from "bknd/adapter/cloudflare";
import type { GetPlatformProxyOptions, PlatformProxy } from "wrangler";
import process from "node:process";
import { $console } from "bknd/utils";

export type WithPlatformProxyOptions = {
   /**
    * By default, proxy is used if the PROXY environment variable is set to 1.
    * You can override/force this by setting this option.
    */
   useProxy?: boolean;
   proxyOptions?: GetPlatformProxyOptions;
};

async function getPlatformProxy(opts?: GetPlatformProxyOptions) {
   try {
      const { version } = await import("wrangler/package.json", { with: { type: "json" } }).then(
         (pkg) => pkg.default,
      );
      $console.log("Using wrangler version", version);
      const { getPlatformProxy } = await import("wrangler");
      return getPlatformProxy(opts);
   } catch (e) {
      $console.error("Failed to import wrangler", String(e));
      const resolved = import.meta.resolve("wrangler");
      $console.log("Wrangler resolved to", resolved);
      const file = resolved?.split("/").pop();
      if (file?.endsWith(".json")) {
         $console.error(
            "You have a `wrangler.json` in your current directory. Please change to .jsonc or .toml",
         );
      }
   }

   process.exit(1);
}

export function withPlatformProxy<Env extends CloudflareEnv>(
   config: CloudflareBkndConfig<Env> = {},
   opts?: WithPlatformProxyOptions,
) {
   const use_proxy =
      typeof opts?.useProxy === "boolean" ? opts.useProxy : process.env.PROXY === "1";
   let proxy: PlatformProxy | undefined;

   $console.log("Using cloudflare platform proxy");

   async function getEnv(env?: Env): Promise<Env> {
      if (use_proxy) {
         if (!proxy) {
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
      // @ts-ignore
      app: async (_env) => {
         const env = await getEnv(_env);
         const binding = use_proxy ? getBinding(env, "D1Database") : undefined;
         const appConfig = typeof config.app === "function" ? await config.app(env) : config;
         const connection =
            use_proxy && binding
               ? d1Sqlite({
                    binding: binding.value as any,
                 })
               : appConfig.connection;

         return {
            ...appConfig,
            beforeBuild: async (app, registries) => {
               if (!use_proxy) return;
               const env = await getEnv();
               registerMedia(env, registries as any);
               await config?.beforeBuild?.(app, registries);
            },
            bindings: async (env) => {
               return (await config?.bindings?.(await getEnv(env))) || {};
            },
            connection,
         };
      },
   } satisfies CloudflareBkndConfig<Env>;
}
