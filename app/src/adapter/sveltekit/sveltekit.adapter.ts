import { type FrameworkBkndConfig, createRuntimeApp } from "bknd/adapter";

type TSvelteKit = {
   request: Request;
};

export type SvelteKitBkndConfig<Env> = FrameworkBkndConfig<Env> & {
   adminOptions?: {
      adminBasepath?: string;
      assetsPath?: string;
   };
};

/**
 * Get bknd app instance
 * @param config - bknd configuration
 * @param args - environment variables (use $env/dynamic/private for universal runtime support)
 */
export async function getApp<Env>(
   config: SvelteKitBkndConfig<Env> = {} as SvelteKitBkndConfig<Env>,
   args: Env,
) {
   return await createRuntimeApp(config, args);
}

/**
 * Create request handler for hooks.server.ts
 * @param config - bknd configuration
 * @param args - environment variables (use $env/dynamic/private for universal runtime support)
 */
export function serve<Env>(
   config: SvelteKitBkndConfig<Env> = {} as SvelteKitBkndConfig<Env>,
   args: Env,
) {
   return async (fnArgs: TSvelteKit) => {
      return (await getApp(config, args)).fetch(fnArgs.request);
   };
}
