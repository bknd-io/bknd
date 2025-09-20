import { App, type AppConfig, type AppPlugin, type MaybePromise, type ModuleConfigs } from "bknd";

export type SyncConfigOptions = {
   enabled?: boolean;
   includeSecrets?: boolean;
   includeFirstBoot?: boolean;
   write: (config: ModuleConfigs) => MaybePromise<void>;
};

export function syncConfig({
   enabled = true,
   includeSecrets = false,
   includeFirstBoot = false,
   write,
}: SyncConfigOptions): AppPlugin {
   let firstBoot = true;

   const getConfigs = (app: App, secrets = false) => {
      if (secrets) {
         return app.toJSON(true);
      }
      return app.modules.extractSecrets().configs;
   };

   return (app: App) => ({
      name: "bknd-sync-config",
      onBuilt: async () => {
         if (!enabled) return;
         app.emgr.onEvent(
            App.Events.AppConfigUpdatedEvent,
            async () => {
               await write?.(getConfigs(app, includeSecrets));
            },
            {
               id: "sync-config",
            },
         );

         if (firstBoot && includeFirstBoot) {
            firstBoot = false;
            await write?.(getConfigs(app, includeSecrets));
         }
      },
   });
}
