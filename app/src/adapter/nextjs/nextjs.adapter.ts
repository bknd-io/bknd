import {
   createFrameworkApp,
   type FrameworkBkndConfig,
   type DefaultArgs,
   type FrameworkOptions,
} from "bknd/adapter";
import { isNode } from "bknd/utils";
import type { NextApiRequest } from "next";

export type NextjsArgs = DefaultArgs & {
   env: NextApiRequest["env"];
};

export type NextjsBkndConfig<Args extends NextjsArgs = NextjsArgs> = FrameworkBkndConfig<Args> & {
   cleanRequest?: { searchParams?: string[] };
};

export async function getApp<Args extends NextjsArgs = NextjsArgs>(
   config: NextjsBkndConfig,
   args?: Args,
   opts?: FrameworkOptions,
) {
   return await createFrameworkApp(config, args, opts);
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

export function serve(
   { cleanRequest, ...config }: NextjsBkndConfig = {},
   args?: NextjsArgs,
   opts?: FrameworkOptions,
) {
   return async (req: Request) => {
      const app = await getApp(config, args ?? { env: (process.env as any) ?? {} }, opts);
      const request = getCleanRequest(req, cleanRequest);
      return app.fetch(request);
   };
}
