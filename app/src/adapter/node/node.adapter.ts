import path from "node:path";
import { serve as honoServe } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { registerLocalMediaAdapter } from "adapter/node/index";
import { type RuntimeBkndConfig, createRuntimeApp, type RuntimeOptions } from "bknd/adapter";
import { config as $config } from "bknd/core";

export type NodeArgs = {
   env: NodeJS.ProcessEnv;
};
export type NodeBkndConfig<Args = NodeArgs> = RuntimeBkndConfig<Args> & {
   port?: number;
   hostname?: string;
   listener?: Parameters<typeof honoServe>[1];
   /** @deprecated */
   relativeDistPath?: string;
};

export async function createApp<Args = NodeArgs>(
   { distPath, relativeDistPath, ...config }: NodeBkndConfig<Args> = {},
   args?: Args,
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

export function createHandler<Args = NodeArgs>(
   config: NodeBkndConfig<Args> = {},
   args?: Args,
   opts?: RuntimeOptions,
) {
   return async (req: Request) => {
      const app = await createApp(config, args ?? ({ env: process.env } as Args), opts);
      return app.fetch(req);
   };
}

export function serve<Args = NodeArgs>(
   { port = $config.server.default_port, hostname, listener, ...config }: NodeBkndConfig<Args> = {},
   args?: Args,
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
