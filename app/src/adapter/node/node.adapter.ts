import path from "node:path";
import { serve as honoServe } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { registerLocalMediaAdapter } from "adapter/node/index";
import { type RuntimeBkndConfig, createRuntimeApp, type RuntimeOptions } from "bknd/adapter";
import { config as $config } from "bknd/core";

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
   args: Env = {} as Env,
   opts?: RuntimeOptions,
) {
   const root = path.relative(
      process.cwd(),
      path.resolve(distPath ?? relativeDistPath ?? "./node_modules/bknd/dist", "static"),
   );
   if (relativeDistPath) {
      console.warn("relativeDistPath is deprecated, please use distPath instead");
   }

   registerLocalMediaAdapter();
   return await createRuntimeApp(
      {
         ...config,
         serveStatic: serveStatic({ root }),
      },
      // @ts-ignore
      args ?? { env: process.env },
      opts,
   );
}

export function createHandler<Env = NodeEnv>(
   config: NodeBkndConfig<Env> = {},
   args: Env = {} as Env,
   opts?: RuntimeOptions,
) {
   return async (req: Request) => {
      const app = await createApp(config, args ?? (process.env as Env), opts);
      return app.fetch(req);
   };
}

export function serve<Env = NodeEnv>(
   { port = $config.server.default_port, hostname, listener, ...config }: NodeBkndConfig<Env> = {},
   args: Env = {} as Env,
   opts?: RuntimeOptions,
) {
   honoServe(
      {
         port,
         hostname,
         fetch: createHandler(config, args, opts),
      },
      (connInfo) => {
         console.log(`Server is running on http://localhost:${connInfo.port}`);
         listener?.(connInfo);
      },
   );
}
