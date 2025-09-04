import { type FrameworkBkndConfig, createFrameworkApp } from "bknd/adapter";

type AstroEnv = NodeJS.ProcessEnv;
type TAstro = {
   request: Request;
};
export type AstroBkndConfig<Env = AstroEnv> = FrameworkBkndConfig<Env>;

export async function getApp<Env = AstroEnv>(
   config: AstroBkndConfig<Env> = {},
   args: Env = {} as Env,
) {
   return await createFrameworkApp(config, args ?? import.meta.env);
}

export function serve<Env = AstroEnv>(config: AstroBkndConfig<Env> = {}, args: Env = {} as Env) {
   return async (fnArgs: TAstro) => {
      return (await getApp(config, args)).fetch(fnArgs.request);
   };
}
