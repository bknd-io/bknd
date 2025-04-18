import { registerMedia } from "./storage/StorageR2Adapter";
import { getBinding } from "./bindings";
import { D1Connection } from "./D1Connection";
import type { CloudflareBkndConfig, CloudflareEnv } from ".";
import { App } from "bknd";
import { makeConfig as makeAdapterConfig } from "bknd/adapter";
import type { ExecutionContext } from "hono";
import { $console } from "core";

export const constants = {
   exec_async_event_id: "cf_register_waituntil",
   cache_endpoint: "/__bknd/cache",
   do_endpoint: "/__bknd/do",
};

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
         $console.log("Using database from bindings");
         db = bindings.db;
      } else if (Object.keys(args).length > 0) {
         const binding = getBinding(args, "D1Database");
         if (binding) {
            $console.log(`Using database from env "${binding.key}"`);
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

export function registerAsyncsExecutionContext(
   app: App,
   ctx: { waitUntil: ExecutionContext["waitUntil"] },
) {
   app.emgr.onEvent(
      App.Events.AppBeforeResponse,
      async (event) => {
         ctx.waitUntil(event.params.app.emgr.executeAsyncs());
      },
      {
         mode: "sync",
         id: constants.exec_async_event_id,
      },
   );
}
