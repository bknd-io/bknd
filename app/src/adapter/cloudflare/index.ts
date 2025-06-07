import { D1Connection, type D1ConnectionConfig } from "./connection/D1Connection";

export * from "./cloudflare-workers.adapter";
export { makeApp, getFresh } from "./modes/fresh";
export { getCached } from "./modes/cached";
export { DurableBkndApp, getDurable } from "./modes/durable";
export { D1Connection, type D1ConnectionConfig };
export {
   getBinding,
   getBindings,
   type BindingTypeMap,
   type GetBindingType,
   type BindingMap,
} from "./bindings";
export { constants } from "./config";

export function d1(config: D1ConnectionConfig) {
   return new D1Connection(config);
}
