import { getApp as getBkndApp } from "bknd/adapter/solid-start";
import bkndConfig from "../../bknd.config";
import type { App } from "bknd";

let client: App | null = null;

export const getApp = async () => {
  if (!client) {
    client = await getBkndApp(bkndConfig);
  }
  return client;
};

export async function getApi({
  headers,
  verify,
}: {
  verify?: boolean;
  headers?: Headers;
}) {
  const app = await getApp();

  if (verify) {
    const api = app.getApi({ headers });
    await api.verifyAuth();
    return api;
  }

  return app.getApi();
}
