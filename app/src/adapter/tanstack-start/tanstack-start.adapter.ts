import { createFrameworkApp, type FrameworkBkndConfig } from "bknd/adapter";

export type TanstackStartEnv = NodeJS.ProcessEnv;

export type TanstackStartConfig<Env = TanstackStartEnv> =
  FrameworkBkndConfig<Env>;

/**
 * Get bknd app instance
 * @param config - bknd configuration
 * @param args - environment variables
 */
export async function getApp<Env = TanstackStartEnv>(
  config: TanstackStartConfig<Env> = {},
  args: Env = process.env as Env,
) {
  return await createFrameworkApp(config, args);
}

/**
 * Create request handler for src/routes/api.$.ts
 * @param config - bknd configuration
 * @param args - environment variables
 */
export function serve<Env = TanstackStartEnv>(
  config: TanstackStartConfig<Env> = {},
  args: Env = process.env as Env,
) {
  return async (request: Request) => {
    const app = await getApp(config, args);
    return app.fetch(request);
  };
}
