import { type FrameworkBkndConfig, createFrameworkApp } from "bknd/adapter";

type ReactRouterEnv = NodeJS.ProcessEnv;
type ReactRouterFunctionArgs = {
   request: Request;
};
export type ReactRouterBkndConfig<Env = ReactRouterEnv> = FrameworkBkndConfig<Env>;

export async function getApp<Env = ReactRouterEnv>(
   config: ReactRouterBkndConfig<Env>,
   args: Env = {} as Env,
) {
   return await createFrameworkApp(config, args ?? process.env);
}

export function serve<Env = ReactRouterEnv>(
   config: ReactRouterBkndConfig<Env> = {},
   args: Env = {} as Env,
) {
   return async (fnArgs: ReactRouterFunctionArgs) => {
      return (await getApp(config, args)).fetch(fnArgs.request);
   };
}
