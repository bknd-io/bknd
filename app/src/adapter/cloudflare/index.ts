import { d1Sqlite, type D1ConnectionConfig } from "./connection/D1Connection";

export {
   getFresh,
   createApp,
   type CloudflareEnv,
   type CloudflareBkndConfig,
} from "./cloudflare-workers.adapter";
export { d1Sqlite, type D1ConnectionConfig };
export { doSqlite, type DoConnectionConfig } from "./connection/DoConnection";
export {
   getBinding,
   getBindings,
   type BindingTypeMap,
   type GetBindingType,
   type BindingMap,
} from "./bindings";
export { constants, type CloudflareContext } from "./config";
export { StorageR2Adapter, registerMedia } from "./storage/StorageR2Adapter";
export { registries } from "bknd";
export { devFsVitePlugin, devFsWrite } from "./vite";

// for compatibility with old code
export function d1<DB extends D1Database | D1DatabaseSession = D1Database>(
   config: D1ConnectionConfig<DB>,
) {
   return d1Sqlite<DB>(config);
}
