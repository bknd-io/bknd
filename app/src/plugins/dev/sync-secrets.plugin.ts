import { type App, ModuleManagerEvents, type AppPlugin } from "bknd";
import type { DbModuleManager } from "modules/db/DbModuleManager";

export type SyncSecretsOptions = {
   enabled?: boolean;
   write: (secrets: Record<string, any>) => Promise<void>;
};

export function syncSecrets({ enabled = true, write }: SyncSecretsOptions): AppPlugin {
   let firstBoot = true;
   return (app: App) => ({
      name: "bknd-sync-secrets",
      onBuilt: async () => {
         if (!enabled) return;
         const manager = app.modules as DbModuleManager;

         if (!("extractSecrets" in manager)) {
            throw new Error("ModuleManager does not support secrets");
         }

         app.emgr.onEvent(
            ModuleManagerEvents.ModuleManagerSecretsExtractedEvent,
            async ({ params: { secrets } }) => {
               await write?.(secrets);
            },
            {
               id: "sync-secrets",
            },
         );

         if (firstBoot) {
            firstBoot = false;
            await write?.(manager.extractSecrets().secrets);
         }
      },
   });
}
