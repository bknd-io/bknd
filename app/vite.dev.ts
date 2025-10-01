import { readFile } from "node:fs/promises";
import { serveStatic } from "@hono/node-server/serve-static";
import { showRoutes } from "hono/dev";
import { App, registries, type CreateAppConfig } from "./src";
import { StorageLocalAdapter } from "./src/adapter/node";
import { nodeSqlite } from "./src/adapter/node/connection/NodeSqliteConnection";
import { libsql } from "./src/data/connection/sqlite/libsql/LibsqlConnection";
import { $console } from "core/utils/console";
import { createClient } from "@libsql/client";
import util from "node:util";
import { d1Sqlite } from "adapter/cloudflare/connection/D1Connection";

util.inspect.defaultOptions.depth = 5;
registries.media.register("local", StorageLocalAdapter);

const config: CreateAppConfig = {};

const dbType = import.meta.env.VITE_DB_TYPE ?? "node";
$console.debug("Using db type", dbType);

let dbUrl = import.meta.env.VITE_DB_URL ?? ":memory:";

const example = import.meta.env.VITE_EXAMPLE;
if (example) {
   const configPath = `.configs/${example}.json`;
   $console.debug("Loading config from", configPath);
   const exampleConfig = JSON.parse(await readFile(configPath, "utf-8"));
   config.config = exampleConfig;
   dbUrl = `file:.configs/${example}.db`;
}

switch (dbType) {
   case "libsql": {
      $console.debug("Using libsql connection", dbUrl);
      const authToken = import.meta.env.VITE_DB_LIBSQL_TOKEN;
      config.connection = libsql(
         createClient({
            url: dbUrl,
            authToken,
         }),
      );
      break;
   }
   case "d1": {
      $console.debug("Using d1 connection");

      const { getPlatformProxy } = await import("wrangler");
      const platformProxy = await getPlatformProxy({
         configPath: "./vite.wrangler.json",
      });
      config.connection = d1Sqlite({ binding: platformProxy.env.DB as any });
      break;
   }
   default: {
      $console.debug("Using node-sqlite connection", dbUrl);
      config.connection = nodeSqlite({ url: dbUrl });
      break;
   }
}

let app: App;
const recreate = import.meta.env.VITE_APP_FRESH === "1";
const debugRerenders = import.meta.env.VITE_DEBUG_RERENDERS === "1";
let firstStart = true;
export default {
   async fetch(request: Request) {
      if (!app || recreate) {
         const sync = !!(firstStart && example);

         app = App.create(config);
         app.emgr.onEvent(
            App.Events.AppBuiltEvent,
            async () => {
               app.registerAdminController({ forceDev: true, debugRerenders });
               app.module.server.client.get("/assets/*", serveStatic({ root: "./" }));
            },
            "sync",
         );
         await app.build({
            sync,
         });

         // log routes
         if (firstStart) {
            firstStart = false;

            if (import.meta.env.VITE_SHOW_ROUTES === "1") {
               console.info("\n[APP ROUTES]");
               showRoutes(app.server);
               console.info("-------\n");
            }
         }
      }

      return app.fetch(request);
   },
};
