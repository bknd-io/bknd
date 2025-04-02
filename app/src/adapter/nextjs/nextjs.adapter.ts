import { createFrameworkApp, type FrameworkBkndConfig, type FrameworkOptions } from "bknd/adapter";
import { isNode } from "bknd/utils";
import type { NextApiRequest } from "next";

type NextjsEnv = NextApiRequest["env"];

export type NextjsBkndConfig<Env = NextjsEnv> = FrameworkBkndConfig<Env> & {
   cleanRequest?: { searchParams?: string[] };
};

export async function getApp<Env = NextjsEnv>(
   config: NextjsBkndConfig<Env>,
   args: Env = {} as Env,
   opts?: FrameworkOptions,
) {
   return await createFrameworkApp(config, args ?? (process.env as Env), opts);
}

function getCleanRequest(req: Request, cleanRequest: NextjsBkndConfig["cleanRequest"]) {
   if (!cleanRequest) return req;

   const url = new URL(req.url);
   cleanRequest?.searchParams?.forEach((k) => url.searchParams.delete(k));

   if (isNode()) {
      return new Request(url.toString(), {
         method: req.method,
         headers: req.headers,
         body: req.body,
         // @ts-ignore
         duplex: "half",
      });
   }

   return new Request(url.toString(), {
      method: req.method,
      headers: req.headers,
      body: req.body,
   });
}

export function serve<Env = NextjsEnv>(
   { cleanRequest, ...config }: NextjsBkndConfig<Env> = {},
   args: Env = {} as Env,
   opts?: FrameworkOptions,
) {
   return async (req: Request) => {
      const app = await getApp(config, args, opts);
      const request = getCleanRequest(req, cleanRequest);
      return app.fetch(request);
   };
}
