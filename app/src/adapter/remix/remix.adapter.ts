import type { App } from "bknd";
import { type FrameworkBkndConfig, createFrameworkApp } from "bknd/adapter";

export type RemixBkndConfig<Args = RemixContext> = FrameworkBkndConfig<Args>;

type RemixContext = {
   request: Request;
};

let app: App;
let building: boolean = false;

export async function getApp<Args extends RemixContext = RemixContext>(
   config: RemixBkndConfig<Args>,
   args?: Args
) {
   if (building) {
      while (building) {
         await new Promise((resolve) => setTimeout(resolve, 5));
      }
      if (app) return app;
   }

   building = true;
   if (!app) {
      app = await createFrameworkApp(config, args);
      await app.build();
   }
   building = false;
   return app;
}

export function serve<Args extends RemixContext = RemixContext>(
   config: RemixBkndConfig<Args> = {}
) {
   return async (args: Args) => {
      app = await getApp(config, args);
      return app.fetch(args.request);
   };
}
