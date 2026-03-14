import { createRuntimeApp, type RuntimeBkndConfig } from "bknd/adapter";

export type SolidStartEnv = NodeJS.ProcessEnv;
export type SolidStartBkndConfig<Env = SolidStartEnv> = RuntimeBkndConfig<Env>;

export async function getApp<Env = SolidStartEnv>(
   config: SolidStartBkndConfig<Env>,
   args: Env = process.env as Env,
) {
   return await createRuntimeApp(config, args);
}


export function serve<Env = SolidStartEnv>(
   config: SolidStartBkndConfig<Env> = {},
   args: Env = process.env as Env,
) {
   return async (req: Request) => {
      const app = await getApp(config, args);
      return app.fetch(req);
   };
}
