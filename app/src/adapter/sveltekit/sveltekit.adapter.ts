import { type FrameworkBkndConfig, createFrameworkApp } from "bknd/adapter";

type SvelteKitEnv = NodeJS.ProcessEnv;
type TSvelteKit = {
   request: Request;
};
export type SvelteKitBkndConfig<Env = SvelteKitEnv> = FrameworkBkndConfig<Env>;

export async function getApp<Env = SvelteKitEnv>(
   config: SvelteKitBkndConfig<Env> = {},
   args: Env = process.env as Env,
) {
   return await createFrameworkApp(config, args);
}

export function serve<Env = SvelteKitEnv>(
   config: SvelteKitBkndConfig<Env> = {},
   args: Env = process.env as Env,
) {
   return async (fnArgs: TSvelteKit) => {
      return (await getApp(config, args)).fetch(fnArgs.request);
   };
}
