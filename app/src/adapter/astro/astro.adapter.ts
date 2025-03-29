import { type FrameworkBkndConfig, createFrameworkApp, type FrameworkOptions } from "bknd/adapter";

type AstroEnv = NodeJS.ProcessEnv;
type TAstro = {
   request: Request;
};
export type AstroBkndConfig<Env = AstroEnv> = FrameworkBkndConfig<Env>;

export async function getApp<Env = AstroEnv>(
   config: AstroBkndConfig<Env> = {},
   args: Env = {} as Env,
   opts: FrameworkOptions = {},
) {
   return await createFrameworkApp(config, args ?? import.meta.env, opts);
}

export function serve<Env = AstroEnv>(
   config: AstroBkndConfig<Env> = {},
   args: Env = {} as Env,
   opts?: FrameworkOptions,
) {
   return async (fnArgs: TAstro) => {
      return (await getApp(config, args, opts)).fetch(fnArgs.request);
   };
}
