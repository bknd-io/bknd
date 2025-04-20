import path from "node:path";
import type { Config } from "@libsql/client/node";
import { $console, config } from "core";
import type { MiddlewareHandler } from "hono";
import open from "open";
import { fileExists, getRelativeDistPath } from "../../utils/sys";
import type { App } from "App";

export const PLATFORMS = ["node", "bun"] as const;
export type Platform = (typeof PLATFORMS)[number];

export async function serveStatic(server: Platform): Promise<MiddlewareHandler> {
   switch (server) {
      case "node": {
         const m = await import("@hono/node-server/serve-static");
         return m.serveStatic({
            // somehow different for node
            root: getRelativeDistPath() + "/static",
         });
      }
      case "bun": {
         const m = await import("hono/bun");
         return m.serveStatic({
            root: path.resolve(getRelativeDistPath(), "static"),
         });
      }
   }
}

export async function attachServeStatic(app: any, platform: Platform) {
   app.module.server.client.get(config.server.assets_path + "*", await serveStatic(platform));
}

export async function startServer(
   server: Platform,
   app: App,
   options: { port: number; open?: boolean },
) {
   const port = options.port;
   $console.log(`Using ${server} serve`);

   switch (server) {
      case "node": {
         // https://github.com/honojs/node-server/blob/main/src/response.ts#L88
         const serve = await import("@hono/node-server").then((m) => m.serve);
         serve({
            fetch: (req) => app.fetch(req),
            port,
         });
         break;
      }
      case "bun": {
         Bun.serve({
            fetch: (req) => app.fetch(req),
            port,
         });
         break;
      }
   }

   const url = `http://localhost:${port}`;
   $console.info("Server listening on", url);

   if (options.open) {
      await open(url);
   }
}

export async function getConfigPath(filePath?: string) {
   if (filePath) {
      const config_path = path.resolve(process.cwd(), filePath);
      if (await fileExists(config_path)) {
         return config_path;
      }
   }

   const exts = ["", ".js", ".ts", ".mjs", ".cjs", ".json"];
   const paths = exts.map((e) => `bknd.config${e}`);
   for (const p of paths) {
      const _p = path.resolve(process.cwd(), p);
      if (await fileExists(_p)) {
         return _p;
      }
   }

   return;
}

export function getConnectionCredentialsFromEnv() {
   const dbUrl = process.env.DB_URL;
   const dbToken = process.env.DB_TOKEN;
   return dbUrl ? { url: dbUrl, authToken: dbToken } : undefined;
}
