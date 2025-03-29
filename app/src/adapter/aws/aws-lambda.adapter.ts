import type { App } from "bknd";
import { handle } from "hono/aws-lambda";
import { type RuntimeBkndConfig, createRuntimeApp } from "bknd/adapter";

export type AwsLambdaBkndConfig = RuntimeBkndConfig & {
   assets?:
      | {
           mode: "local";
           root: string;
        }
      | {
           mode: "url";
           url: string;
        };
};

let app: App;
export async function createApp({
   adminOptions = false,
   assets,
   ...config
}: AwsLambdaBkndConfig = {}) {
   if (!app) {
      let additional: Partial<RuntimeBkndConfig> = {
         adminOptions,
      };

      if (assets?.mode) {
         switch (assets.mode) {
            case "local":
               // @todo: serve static outside app context
               additional = {
                  adminOptions: adminOptions === false ? undefined : adminOptions,
                  serveStatic: (await import("@hono/node-server/serve-static")).serveStatic({
                     root: assets.root,
                     onFound: (path, c) => {
                        c.res.headers.set("Cache-Control", "public, max-age=31536000");
                     },
                  }),
               };
               break;
            case "url":
               additional.adminOptions = {
                  ...(typeof adminOptions === "object" ? adminOptions : {}),
                  assets_path: assets.url,
               };
               break;
            default:
               throw new Error("Invalid assets mode");
         }
      }

      app = await createRuntimeApp({
         ...config,
         ...additional,
      });
   }

   return app;
}

export function serveLambda(config: AwsLambdaBkndConfig = {}) {
   return async (event) => {
      const app = await createApp(config);
      return await handle(app.server)(event);
   };
}
