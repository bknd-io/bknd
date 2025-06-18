import { App, type AppPlugin } from "bknd";
import { EntityTypescript } from "data/entities/EntityTypescript";

export type SyncTypesOptions = {
   enabled?: boolean;
   write: (et: EntityTypescript) => Promise<void>;
};

export function syncTypes({ enabled = true, write }: SyncTypesOptions): AppPlugin {
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

         if (firstBoot) {
            firstBoot = false;
            await write?.(new EntityTypescript(app.em));
         }
      },
   });
}
