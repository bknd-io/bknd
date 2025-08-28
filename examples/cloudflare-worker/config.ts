import type { CloudflareBkndConfig } from "bknd/adapter/cloudflare";
import { syncTypes } from "bknd/plugins";
import { writeFile } from "node:fs/promises";

const isDev = !import.meta.env.PROD;

export default {
   d1: {
      session: true,
   },
   options: {
      plugins: [
         syncTypes({
            enabled: isDev,
            write: async (et) => {
               await writeFile("bknd-types.d.ts", et.toString());
            },
         }),
      ],
   },
} satisfies CloudflareBkndConfig;
