import { readFile } from "node:fs/promises";
import { serveStatic } from "@hono/node-server/serve-static";
import { showRoutes } from "hono/dev";
import { App, registries } from "./src";
import { StorageLocalAdapter } from "./src/media/storage/adapters/StorageLocalAdapter";

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

let initialConfig: any = undefined;
if (example) {
   const { version, ...config } = JSON.parse(await readFile(`.configs/${example}.json`, "utf-8"));
   initialConfig = config;
}

let app: App;
const recreate = import.meta.env.VITE_APP_DISABLE_FRESH !== "1";
let firstStart = true;
export default {
   async fetch(request: Request) {
      if (!app || recreate) {
         app = App.create({
            connection: credentials,
            initialConfig,
         });
         app.emgr.onEvent(
            App.Events.AppBuiltEvent,
            async () => {
               app.registerAdminController({ forceDev: true });
               app.module.server.client.get("/assets/*", serveStatic({ root: "./" }));
            },
            "sync",
         );
         await app.build();

         // log routes
         if (firstStart) {
            firstStart = false;
            console.log("[DB]", credentials);

            if (import.meta.env.VITE_SHOW_ROUTES === "1") {
               console.log("\n[APP ROUTES]");
               showRoutes(app.server);
               console.log("-------\n");
            }
         }
      }

      return app.fetch(request);
   },
};
