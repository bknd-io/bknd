import { registries } from "bknd";
import { type LocalAdapterConfig, StorageLocalAdapter } from "./storage/StorageLocalAdapter";

export * from "./node.adapter";
export { StorageLocalAdapter, type LocalAdapterConfig };
export { nodeTestRunner } from "./test";

export function registerLocalMediaAdapter() {
   registries.media.register("local", StorageLocalAdapter);
}
