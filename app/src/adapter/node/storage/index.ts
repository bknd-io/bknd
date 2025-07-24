import { registries } from "bknd";
import { type LocalAdapterConfig, StorageLocalAdapter } from "./StorageLocalAdapter";

export * from "./StorageLocalAdapter";

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
