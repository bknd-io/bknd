import { createRuntimeApp, type RuntimeBkndConfig } from "bknd/adapter";

export type NuxtEnv = NodeJS.ProcessEnv;
export type NuxtBkndConfig<Env = NuxtEnv> = RuntimeBkndConfig<Env>;

/**
 * Get bknd app instance
 * @param config - bknd configuration
 * @param args - environment variables
 */
export async function getApp<Env>(
   config: NuxtBkndConfig<Env> = {} as NuxtBkndConfig<Env>,
   args: Env,
) {
   return await createRuntimeApp(config, args);
}

/**
 * Create middleware handler for Nuxt
 * @param config - bknd configuration
 * @param args - environment variables
 */
export function serve<Env>(
   config: NuxtBkndConfig<Env> = {} as NuxtBkndConfig<Env>,
   args: Env,
) {
   return async (request: Request) => {
      return (await getApp(config, args)).fetch(request);
   };
}
