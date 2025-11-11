import { createFrameworkApp, type FrameworkBkndConfig } from "bknd/adapter";
import { isNode } from "bknd/utils";
// @ts-expect-error next is not installed
import type { NextApiRequest } from "next";

type NextjsEnv = NextApiRequest["env"];
export type NextjsBkndConfig<Env = NextjsEnv> = FrameworkBkndConfig<Env> & {
   cleanRequest?: { searchParams?: string[] };
};

export async function getApp<Env = NextjsEnv>(
   config: NextjsBkndConfig<Env>,
   args: Env = process.env as Env,
) {
   return await createFrameworkApp(config, args);
}

function getCleanRequest(req: Request, cleanRequest: NextjsBkndConfig["cleanRequest"]) {
   if (!cleanRequest) return req;

   const url = new URL(req.url);
   cleanRequest?.searchParams?.forEach((k) => {
      url.searchParams.delete(k);
   });

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
   args: Env = process.env as Env,
) {
   return async (req: Request) => {
      const app = await getApp(config, args);
      const request = getCleanRequest(req, cleanRequest);
      return app.fetch(request);
   };
}
