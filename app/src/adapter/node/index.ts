import { registries } from "bknd";
import { type LocalAdapterConfig, StorageLocalAdapter } from "./storage/StorageLocalAdapter";

export * from "./node.adapter";
export { StorageLocalAdapter, type LocalAdapterConfig };

let registered = false;
export function registerLocalMediaAdapter() {
   if (!registered) {
      registries.media.register("local", StorageLocalAdapter);
      registered = true;
   }

   return (config: Partial<LocalAdapterConfig> = {}) => {
      const adapter = new StorageLocalAdapter(config);
      return adapter.toJSON(true);
   };
}
