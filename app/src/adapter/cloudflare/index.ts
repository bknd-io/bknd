import { d1Sqlite, type D1ConnectionConfig } from "./connection/D1Connection";

export * from "./cloudflare-workers.adapter";
export { makeApp, getFresh } from "./modes/fresh";
export { getCached } from "./modes/cached";
export { DurableBkndApp, getDurable } from "./modes/durable";
export { d1Sqlite, type D1ConnectionConfig };
export {
   getBinding,
   getBindings,
   type BindingTypeMap,
   type GetBindingType,
   type BindingMap,
} from "./bindings";
export { constants } from "./config";
export { StorageR2Adapter } from "./storage/StorageR2Adapter";
export { registries } from "bknd";

// for compatibility with old code
export function d1<DB extends D1Database | D1DatabaseSession = D1Database>(
   config: D1ConnectionConfig<DB>,
) {
   return d1Sqlite<DB>(config);
}
