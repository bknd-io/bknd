import { registerMedia } from "./storage/StorageR2Adapter";
import { getBinding } from "adapter/cloudflare/bindings";
import { D1Connection } from "adapter/cloudflare/D1Connection";
import type { CloudflareBkndConfig, CloudflareEnv } from ".";
import { makeConfig as makeAdapterConfig } from "bknd/adapter";

let media_registered: boolean = false;
export function makeConfig<Env extends CloudflareEnv = CloudflareEnv>(
   config: CloudflareBkndConfig<Env>,
   args: Env = {} as Env,
) {
   if (!media_registered) {
      registerMedia(args as any);
      media_registered = true;
   }

   const appConfig = makeAdapterConfig(config, args);
   const bindings = config.bindings?.(args);
   if (!appConfig.connection) {
      let db: D1Database | undefined;
      if (bindings?.db) {
         console.log("Using database from bindings");
         db = bindings.db;
      } else if (Object.keys(args).length > 0) {
         const binding = getBinding(args, "D1Database");
         if (binding) {
            console.log(`Using database from env "${binding.key}"`);
            db = binding.value;
         }
      }

      if (db) {
         appConfig.connection = new D1Connection({ binding: db });
      } else {
         throw new Error("No database connection given");
      }
   }

   return appConfig;
}
