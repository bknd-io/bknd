import { App, type AppPlugin, EntityTypescript } from "bknd";

export type SyncTypesOptions = {
   enabled?: boolean;
   includeFirstBoot?: boolean;
   write: (et: EntityTypescript) => Promise<void>;
};

export function syncTypes({
   enabled = true,
   includeFirstBoot = false,
   write,
}: SyncTypesOptions): AppPlugin {
   let firstBoot = true;
   return (app: App) => ({
      name: "bknd-sync-types",
      onBuilt: async () => {
         if (!enabled) return;
         app.emgr.onEvent(
            App.Events.AppConfigUpdatedEvent,
            async () => {
               await write?.(new EntityTypescript(app.em));
            },
            {
               id: "sync-types",
            },
         );

         if (firstBoot && includeFirstBoot) {
            firstBoot = false;
            await write?.(new EntityTypescript(app.em));
         }
      },
   });
}
