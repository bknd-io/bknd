import { overrideJson } from "cli/commands/create/npm";
import type { Template } from "cli/commands/create/templates";
import { getVersion } from "cli/utils/sys";

export const deno = {
   key: "deno",
   title: "Deno Basic",
   integration: "deno",
   description: "A basic bknd Deno server with static assets",
   path: "gh:bknd-io/bknd/examples/deno",
   installDeps: false,
   ref: true,
   setup: async (ctx) => {
      const version = await getVersion();
      await overrideJson(
         "deno.json",
         (json) => ({ ...json, links: undefined, imports: { bknd: `npm:bknd@${version}` } }),
         { dir: ctx.dir },
      );
   },
} satisfies Template;
