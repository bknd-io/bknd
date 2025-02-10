import { D1Connection, type D1ConnectionConfig } from "./connection/D1Connection";

export * from "./cloudflare-workers.adapter";
export { makeApp, getFresh, getWarm } from "./modes/fresh";
export { getCached } from "./modes/cached";
export { DurableBkndApp, getDurable } from "./modes/durable";
export { D1Connection, type D1ConnectionConfig };

export function d1(config: D1ConnectionConfig) {
   return new D1Connection(config);
}
