import type { App, AppPlugin } from "bknd";
import { showRoutes as showRoutesHono } from "hono/dev";

export type ShowRoutesOptions = {
   once?: boolean;
};

export function showRoutes({ once = false }: ShowRoutesOptions = {}): AppPlugin {
   let shown = false;
   return (app: App) => ({
      name: "bknd-show-routes",
      onBuilt: () => {
         if (once && shown) return;
         shown = true;
         showRoutesHono(app.server);
      },
   });
}
