import { createRuntimeApp, type RuntimeBkndConfig } from "bknd/adapter";

export type SolidStartEnv = NodeJS.ProcessEnv;
export type SolidStartBkndConfig<Env = SolidStartEnv> = RuntimeBkndConfig<Env>;

/**
 * Get bknd app instance
 * @param config - bknd configuration
 * @param args - environment variables
 */
export async function getApp<Env = SolidStartEnv>(
   config: SolidStartBkndConfig<Env>,
   args: Env = process.env as Env,
) {
   return await createRuntimeApp(config, args);
}

/**
 * Create middleware handler for Solid Start
 * @param config - bknd configuration
 * @param args - environment variables
 */
export function serve<Env = SolidStartEnv>(
   config: SolidStartBkndConfig<Env> = {},
   args: Env = process.env as Env,
) {
   return async (req: Request) => {
      const app = await getApp(config, args);
      return app.fetch(req);
   };
}
