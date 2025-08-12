/**
 * The configuration below is for advanced use cases. In order to enable types generation,
 * we need access to the database. However, for Cloudflare D1, we need the platform proxy.
 *
 * Since this configuration should serve all purposes, including usage within the worker itself,
 * we need to use an environment variable to determine if we need to extract the DB from proxy.
 *
 * To make D1 session work in the actual worker,
 */

import { d1, registerMedia, type CloudflareBkndConfig } from "bknd/adapter/cloudflare";
import type { PlatformProxy } from "wrangler";
import process from "node:process";

const use_proxy = process.env.PROXY === "1";
let proxy: PlatformProxy | undefined;

async function getEnv(env?: Env): Promise<Env> {
   if (use_proxy) {
      if (!proxy) {
         const getPlatformProxy = await import("wrangler").then((mod) => mod.getPlatformProxy);
         proxy = await getPlatformProxy();
         setTimeout(proxy?.dispose, 1000);
      }
      return proxy.env as unknown as Env;
   }
   return env!;
}

export default {
   app: async (_env) => {
      if (!use_proxy) return {};
      const env = await getEnv(_env);
      return {
         connection: d1({
            binding: env.DB,
         }),
      };
   },
   beforeBuild: async (app, registries) => {
      if (!use_proxy) return;
      registerMedia(await getEnv(), registries);
   },
   d1: {
      session: true,
   },
} satisfies CloudflareBkndConfig<Env>;
