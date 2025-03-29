import { registerMedia } from "./storage/StorageR2Adapter";
import { getBinding } from "adapter/cloudflare/bindings";
import { D1Connection } from "adapter/cloudflare/D1Connection";
import type { CloudflareBkndConfig, Context } from ".";
import { makeConfig as makeAdapterConfig } from "bknd/adapter";

let media_registered: boolean = false;
export function makeConfig(config: CloudflareBkndConfig, context: Context) {
   if (!media_registered) {
      registerMedia(context.env as any);
      media_registered = true;
   }

   const appConfig = makeAdapterConfig(config, context);
   const bindings = config.bindings?.(context);
   if (!appConfig.connection) {
      let db: D1Database | undefined;
      if (bindings?.db) {
         console.log("Using database from bindings");
         db = bindings.db;
      } else if (Object.keys(context.env ?? {}).length > 0) {
         const binding = getBinding(context.env, "D1Database");
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
