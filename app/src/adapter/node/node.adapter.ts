import path from "node:path";
import { serve as honoServe } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { registerLocalMediaAdapter } from "adapter/node/storage";
import { type RuntimeBkndConfig, createRuntimeApp } from "bknd/adapter";
import { config as $config, type App } from "bknd";
import { $console } from "bknd/utils";

type NodeEnv = NodeJS.ProcessEnv;
export type NodeBkndConfig<Env = NodeEnv> = RuntimeBkndConfig<Env> & {
   port?: number;
   hostname?: string;
   listener?: Parameters<typeof honoServe>[1];
   /** @deprecated */
   relativeDistPath?: string;
};

export async function createApp<Env = NodeEnv>(
   { distPath, relativeDistPath, ...config }: NodeBkndConfig<Env> = {},
   args: Env = process.env as Env,
) {
   const root = path.relative(
      process.cwd(),
      path.resolve(distPath ?? relativeDistPath ?? "./node_modules/bknd/dist", "static"),
   );
   if (relativeDistPath) {
      $console.warn("relativeDistPath is deprecated, please use distPath instead");
   }

   registerLocalMediaAdapter();
   return await createRuntimeApp(
      {
         serveStatic: serveStatic({ root }),
         ...config,
      },
      args,
   );
}

export function createHandler<Env = NodeEnv>(
   config: NodeBkndConfig<Env> = {},
   args: Env = process.env as Env,
) {
   let app: App | undefined;
   return async (req: Request) => {
      if (!app) {
         app = await createApp(config, args);
      }
      return app.fetch(req);
   };
}

export function serve<Env = NodeEnv>(
   { port = $config.server.default_port, hostname, listener, ...config }: NodeBkndConfig<Env> = {},
   args: Env = process.env as Env,
) {
   honoServe(
      {
         port,
         hostname,
         fetch: createHandler(config, args),
      },
      (connInfo) => {
         $console.log(`Server is running on http://localhost:${connInfo.port}`);
         listener?.(connInfo);
      },
   );
}
