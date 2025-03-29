import { type FrameworkBkndConfig, createFrameworkApp } from "bknd/adapter";
import type { FrameworkOptions } from "adapter";

type ReactRouterContext = {
   request: Request;
};
export type ReactRouterBkndConfig<Args = ReactRouterContext> = FrameworkBkndConfig<Args>;

export async function getApp<Args extends ReactRouterContext = ReactRouterContext>(
   config: ReactRouterBkndConfig<Args>,
   args?: Args,
   opts?: FrameworkOptions,
) {
   return await createFrameworkApp(config, args, opts);
}

export function serve<Args extends ReactRouterContext = ReactRouterContext>(
   config: ReactRouterBkndConfig<Args> = {},
   args?: Args,
   opts?: FrameworkOptions,
) {
   return async (fnArgs: ReactRouterContext) => {
      // @ts-ignore
      return (await getApp(config, args ?? fnArgs, opts)).fetch(fnArgs.request);
   };
}
