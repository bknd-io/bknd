import { serveStatic } from "@hono/node-server/serve-static";
import { type DevServerOptions, default as honoViteDevServer } from "@hono/vite-dev-server";
import type { App } from "bknd";
import { type RuntimeBkndConfig, createRuntimeApp, type FrameworkOptions } from "bknd/adapter";
import { registerLocalMediaAdapter } from "bknd/adapter/node";
import { devServerConfig } from "./dev-server-config";
import type { MiddlewareHandler } from "hono";

export type ViteEnv = NodeJS.ProcessEnv;
export type ViteBkndConfig<Env = ViteEnv> = RuntimeBkndConfig<Env> & {
   serveStatic?: false | MiddlewareHandler;
};

export function addViteScript(html: string, addBkndContext: boolean = true) {
   return html.replace(
      "</head>",
      `<script type="module">
import RefreshRuntime from "/@react-refresh"
RefreshRuntime.injectIntoGlobalHook(window)
window.$RefreshReg$ = () => {}
window.$RefreshSig$ = () => (type) => type
window.__vite_plugin_react_preamble_installed__ = true
</script>
<script type="module" src="/@vite/client"></script>
${addBkndContext ? "<!-- BKND_CONTEXT -->" : ""}
</head>`,
   );
}

async function createApp<ViteEnv>(
   config: ViteBkndConfig<ViteEnv> = {},
   env: ViteEnv = {} as ViteEnv,
   opts: FrameworkOptions = {},
): Promise<App> {
   registerLocalMediaAdapter();
   return await createRuntimeApp(
      {
         ...config,
         adminOptions: config.adminOptions ?? {
            forceDev: {
               mainPath: "/src/main.tsx",
            },
         },
         serveStatic: config.serveStatic || [
            "/assets/*",
            serveStatic({ root: config.distPath ?? "./" }),
         ],
      },
      env,
      opts,
   );
}

export function serve<ViteEnv>(
   config: ViteBkndConfig<ViteEnv> = {},
   args?: ViteEnv,
   opts?: FrameworkOptions,
) {
   return {
      async fetch(request: Request, env: any, ctx: ExecutionContext) {
         const app = await createApp(config, env, opts);
         return app.fetch(request, env, ctx);
      },
   };
}

export function devServer(options: DevServerOptions) {
   return honoViteDevServer({
      ...devServerConfig,
      ...options,
   });
}
