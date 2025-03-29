import { type FrameworkBkndConfig, createFrameworkApp } from "bknd/adapter";
import type { FrameworkOptions } from "adapter";

type ReactRouterEnv = NodeJS.ProcessEnv;
type ReactRouterFunctionArgs = {
   request: Request;
};
export type ReactRouterBkndConfig<Env = ReactRouterEnv> = FrameworkBkndConfig<Env>;

export async function getApp<Env = ReactRouterEnv>(
   config: ReactRouterBkndConfig<Env>,
   args: Env = {} as Env,
   opts?: FrameworkOptions,
) {
   return await createFrameworkApp(config, args ?? process.env, opts);
}

export function serve<Env = ReactRouterEnv>(
   config: ReactRouterBkndConfig<Env> = {},
   args: Env = {} as Env,
   opts?: FrameworkOptions,
) {
   return async (fnArgs: ReactRouterFunctionArgs) => {
      return (await getApp(config, args, opts)).fetch(fnArgs.request);
   };
}
