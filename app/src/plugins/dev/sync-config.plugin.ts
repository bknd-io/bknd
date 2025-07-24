import { App, type AppConfig, type AppPlugin } from "bknd";

export type SyncConfigOptions = {
   enabled?: boolean;
   includeSecrets?: boolean;
   write: (config: AppConfig) => Promise<void>;
};

export function syncConfig({
   enabled = true,
   includeSecrets = false,
   write,
}: SyncConfigOptions): AppPlugin {
   let firstBoot = true;
   return (app: App) => ({
      name: "bknd-sync-config",
      onBuilt: async () => {
         if (!enabled) return;
         app.emgr.onEvent(
            App.Events.AppConfigUpdatedEvent,
            async () => {
               await write?.(app.toJSON(includeSecrets));
            },
            {
               id: "sync-config",
            },
         );

         if (firstBoot) {
            firstBoot = false;
            await write?.(app.toJSON(true));
         }
      },
   });
}
