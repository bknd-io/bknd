import { type App, ModuleManagerEvents, type AppPlugin } from "bknd";
import type { $diff } from "bknd/core";

export type SyncDiffsOptions = {
   enabled?: boolean;
   write: (name: string, diffs: $diff.DiffEntry[]) => Promise<void>;
};

export function syncDiffs({ enabled = true, write }: SyncDiffsOptions): AppPlugin {
   return (app: App) => ({
      name: "bknd-sync-diffs",
      onBuilt: async () => {
         if (!enabled) return;
         app.emgr.onEvent(
            ModuleManagerEvents.ModuleManagerConfigDiffEvent,
            async (event) => {
               const name = `${new Date().getTime()}.diff.json`;
               await write?.(name, event.params.diffs);
            },
            {
               id: "sync-config",
            },
         );
      },
   });
}
