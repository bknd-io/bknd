import { Api, type ApiOptions, App, type CreateAppConfig } from "bknd";

type TAstro = {
   request: Request;
};

export type Options = {
   mode?: "static" | "dynamic";
} & Omit<ApiOptions, "host"> & {
      host?: string;
   };

export function getApi(Astro: TAstro, options: Options = { mode: "static" }) {
   return new Api({
      host: new URL(Astro.request.url).origin,
      headers: options.mode === "dynamic" ? Astro.request.headers : undefined
   });
}

let app: App;
export function serve(config: CreateAppConfig & { beforeBuild?: (app: App) => Promise<void> }) {
   return async (args: TAstro) => {
      if (!app) {
         app = App.create(config);
         await config.beforeBuild?.(app);
         await app.build();
      }
      return app.fetch(args.request);
   };
}
