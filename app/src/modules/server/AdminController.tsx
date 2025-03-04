/** @jsxImportSource hono/jsx */

import type { App } from "App";
import { config, isDebug } from "core";
import { addFlashMessage } from "core/server/flash";
import { html } from "hono/html";
import { Fragment } from "hono/jsx";
import { css, Style } from "hono/css";
import { Controller } from "modules/Controller";
import * as SystemPermissions from "modules/permissions";
import type { AppTheme } from "modules/server/AppServer";

const htmlBkndContextReplace = "<!-- BKND_CONTEXT -->";

// @todo: add migration to remove admin path from config
export type AdminControllerOptions = {
   basepath?: string;
   assets_path?: string;
   html?: string;
   forceDev?: boolean | { mainPath: string };
   debug_rerenders?: boolean;
};

export class AdminController extends Controller {
   constructor(
      private readonly app: App,
      private _options: AdminControllerOptions = {},
   ) {
      super();
   }

   get ctx() {
      return this.app.modules.ctx();
   }

   get options() {
      return {
         ...this._options,
         basepath: this._options.basepath ?? "/",
         assets_path: this._options.assets_path ?? config.server.assets_path,
      };
   }

   get basepath() {
      return this.options.basepath ?? "/";
   }

   private withBasePath(route: string = "") {
      return (this.basepath + route).replace(/(?<!:)\/+/g, "/");
   }

   override getController() {
      const { auth: authMiddleware, permission } = this.middlewares;
      const hono = this.create().use(
         authMiddleware({
            //skip: [/favicon\.ico$/]
         }),
      );

      const auth = this.app.module.auth;
      const configs = this.app.modules.configs();
      // if auth is not enabled, authenticator is undefined
      const auth_enabled = configs.auth.enabled;

      const authRoutes = {
         root: "/",
         success: configs.auth.cookie.pathSuccess ?? "/",
         loggedOut: configs.auth.cookie.pathLoggedOut ?? "/",
         login: "/auth/login",
         logout: "/auth/logout",
      };

      hono.use("*", async (c, next) => {
         const obj = {
            user: c.get("auth")?.user,
            logout_route: this.withBasePath(authRoutes.logout),
            color_scheme: configs.server.admin.color_scheme,
         };
         const html = await this.getHtml(obj);
         if (!html) {
            console.warn("Couldn't generate HTML for admin UI");
            // re-casting to void as a return is not required
            return c.notFound() as unknown as void;
         }
         c.set("html", html);

         await next();
      });

      if (auth_enabled) {
         hono.get(
            authRoutes.login,
            permission([SystemPermissions.accessAdmin, SystemPermissions.schemaRead], {
               // @ts-ignore
               onGranted: async (c) => {
                  // @todo: add strict test to permissions middleware?
                  if (c.get("auth")?.user) {
                     console.log("redirecting to success");
                     return c.redirect(authRoutes.success);
                  }
               },
            }),
            async (c) => {
               return c.html(c.get("html")!);
            },
         );

         hono.get(authRoutes.logout, async (c) => {
            await auth.authenticator?.logout(c);
            return c.redirect(authRoutes.loggedOut);
         });
      }

      // @todo: only load known paths
      hono.get(
         "/*",
         permission(SystemPermissions.accessAdmin, {
            onDenied: async (c) => {
               addFlashMessage(c, "You are not authorized to access the Admin UI", "error");

               console.log("redirecting");
               return c.redirect(authRoutes.login);
            },
         }),
         permission(SystemPermissions.schemaRead, {
            onDenied: async (c) => {
               addFlashMessage(c, "You not allowed to read the schema", "warning");
            },
         }),
         async (c) => {
            return c.html(c.get("html")!);
         },
      );

      return hono;
   }

   private async getHtml(obj: any = {}) {
      const bknd_context = `window.__BKND__ = JSON.parse('${JSON.stringify(obj)}');`;

      if (this.options.html) {
         if (this.options.html.includes(htmlBkndContextReplace)) {
            return this.options.html.replace(
               htmlBkndContextReplace,
               "<script>" + bknd_context + "</script>",
            );
         }

         console.warn(
            `Custom HTML needs to include '${htmlBkndContextReplace}' to inject BKND context`,
         );
         return this.options.html as string;
      }

      const configs = this.app.modules.configs();
      const isProd = !isDebug() && !this.options.forceDev;
      const mainPath =
         typeof this.options.forceDev === "object" && "mainPath" in this.options.forceDev
            ? this.options.forceDev.mainPath
            : "/src/ui/main.tsx";

      const assets = {
         js: "main.js",
         css: "styles.css",
      };

      if (isProd) {
         let manifest: any;
         if (this.options.assets_path.startsWith("http")) {
            manifest = await fetch(this.options.assets_path + "manifest.json", {
               headers: {
                  Accept: "application/json",
               },
            }).then((res) => res.json());
         } else {
            // @ts-ignore
            manifest = await import("bknd/dist/manifest.json", {
               assert: { type: "json" },
            }).then((res) => res.default);
         }

         // @todo: load all marked as entry (incl. css)
         assets.js = manifest["src/ui/main.tsx"].file;
         assets.css = manifest["src/ui/main.tsx"].css[0] as any;
      }

      const favicon = isProd ? this.options.assets_path + "favicon.ico" : "/favicon.ico";

      return (
         <Fragment>
            {/* dnd complains otherwise */}
            {html`<!DOCTYPE html>`}
            <html lang="en">
               <head>
                  <meta charset="UTF-8" />
                  <meta
                     name="viewport"
                     content="width=device-width, initial-scale=1, maximum-scale=1"
                  />
                  <link rel="icon" href={favicon} type="image/x-icon" />
                  <title>BKND</title>
                  {this.options.debug_rerenders && (
                     <script
                        crossOrigin="anonymous"
                        src="//unpkg.com/react-scan/dist/auto.global.js"
                     />
                  )}
                  {isProd ? (
                     <Fragment>
                        <script type="module" src={this.options.assets_path + assets?.js} />
                        <link rel="stylesheet" href={this.options.assets_path + assets?.css} />
                     </Fragment>
                  ) : (
                     <Fragment>
                        <script
                           type="module"
                           dangerouslySetInnerHTML={{
                              __html: `import RefreshRuntime from "/@react-refresh"
                              RefreshRuntime.injectIntoGlobalHook(window)
                              window.$RefreshReg$ = () => {}
                              window.$RefreshSig$ = () => (type) => type
                              window.__vite_plugin_react_preamble_installed__ = true`,
                           }}
                        />
                        <script type="module" src={"/@vite/client"} />
                     </Fragment>
                  )}
                  <style dangerouslySetInnerHTML={{ __html: "body { margin: 0; padding: 0; }" }} />
               </head>
               <body>
                  <div id="root">
                     <Style />
                     <div id="loading" className={wrapperStyle}>
                        <span className={loaderStyle}>Initializing...</span>
                     </div>
                  </div>
                  <script
                     dangerouslySetInnerHTML={{
                        __html: bknd_context,
                     }}
                  />
                  {!isProd && <script type="module" src={mainPath} />}
               </body>
            </html>
         </Fragment>
      );
   }
}

const wrapperStyle = css`
   margin: 0;
   padding: 0;
   height: 100vh;
   width: 100vw;
   display: flex;
   justify-content: center;
   align-items: center;
   -webkit-font-smoothing: antialiased;
   -moz-osx-font-smoothing: grayscale;
   color: rgb(9,9,11);
   background-color: rgb(250,250,250);
   
   @media (prefers-color-scheme: dark) {
      color: rgb(250,250,250);
      background-color: rgb(30,31,34);
   }
`;

const loaderStyle = css`
   opacity: 0.3;
   font-size: 14px;
   font-family: monospace;
`;
