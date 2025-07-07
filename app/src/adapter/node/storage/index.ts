import type { App } from "bknd";
import { type LocalAdapterConfig, StorageLocalAdapter } from "./StorageLocalAdapter";

export * from "./StorageLocalAdapter";

export function registerLocalMediaAdapter(app: App) {
   app.module.media.adapters.set("local", StorageLocalAdapter);

   return (config: Partial<LocalAdapterConfig> = {}) => {
      const adapter = new StorageLocalAdapter(config);
      return adapter.toJSON(true);
   };
}
