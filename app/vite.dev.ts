import { readFile } from "node:fs/promises";
import { serveStatic } from "@hono/node-server/serve-static";
import { showRoutes } from "hono/dev";
import { App, registries } from "./src";
import { StorageLocalAdapter } from "./src/adapter/node";
import { EntityManager, LibsqlConnection } from "data";
import { __bknd } from "modules/ModuleManager";

registries.media.register("local", StorageLocalAdapter);

const example = import.meta.env.VITE_EXAMPLE;

const credentials = example
   ? {
        url: `file:.configs/${example}.db`,
     }
   : import.meta.env.VITE_DB_URL
     ? {
          url: import.meta.env.VITE_DB_URL!,
          authToken: import.meta.env.VITE_DB_TOKEN!,
       }
     : {
          url: ":memory:",
       };

if (example) {
   const { version, ...config } = JSON.parse(await readFile(`.configs/${example}.json`, "utf-8"));

   // create db with config
   const conn = new LibsqlConnection(credentials);
   const em = new EntityManager([__bknd], conn);
   try {
      await em.schema().sync({ force: true });
   } catch (e) {}
   const { data: existing } = await em.repo(__bknd).findOne({ type: "config" });

   if (!existing || existing.version !== version) {
      if (existing) await em.mutator(__bknd).deleteOne(existing.id);
      await em.mutator(__bknd).insertOne({
         version,
         json: config,
         created_at: new Date(),
         type: "config",
      });
   } else {
      await em.mutator(__bknd).updateOne(existing.id, {
         json: config,
      });
   }
}

let app: App;
const recreate = import.meta.env.VITE_APP_FRESH === "1";
const debugRerenders = import.meta.env.VITE_DEBUG_RERENDERS === "1";
let firstStart = true;
export default {
   async fetch(request: Request) {
      if (!app || recreate) {
         app = App.create({
            connection: credentials,
         });
         app.emgr.onEvent(
            App.Events.AppBuiltEvent,
            async () => {
               app.registerAdminController({ forceDev: true, debugRerenders });
               app.module.server.client.get("/assets/*", serveStatic({ root: "./" }));
            },
            "sync",
         );
         await app.build({
            sync: !!(firstStart && example),
         });

         // log routes
         if (firstStart) {
            firstStart = false;
            // biome-ignore lint/suspicious/noConsoleLog:
            console.log("[DB]", credentials);

            if (import.meta.env.VITE_SHOW_ROUTES === "1") {
               // biome-ignore lint/suspicious/noConsoleLog:
               console.log("\n[APP ROUTES]");
               showRoutes(app.server);
               // biome-ignore lint/suspicious/noConsoleLog:
               console.log("-------\n");
            }
         }
      }

      return app.fetch(request);
   },
};
