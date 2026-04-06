import { createBknd } from "bknd/adapter/web";
import bkndConfig from "../../bknd.config";
import type { EnvGetter } from "@builder.io/qwik-city/middleware/request-handler";

export const getApp = async (env?: EnvGetter) => createBknd({ mode: "standalone", options: bkndConfig }, env);

export const handler = async (req: Request, env?: EnvGetter) => {
   return (await getApp(env)).serve()(req);
};

export const getApi = async (opts?: { headers?: Headers; verify?: boolean }) => {
   return (await getApp()).getApi(opts);
};
