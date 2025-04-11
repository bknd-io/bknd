import path from "node:path";
import url from "node:url";
import { createApp } from "App";
import { getConnectionCredentialsFromEnv } from "cli/commands/run/platform";
import { getDistPath, getRelativeDistPath, getRootPath } from "cli/utils/sys";
import { Argument } from "commander";
import { showRoutes } from "hono/dev";
import type { CliCommand } from "../types";

export const debug: CliCommand = (program) => {
   program
      .command("debug")
      .description("debug bknd")
      .addArgument(new Argument("<subject>", "subject to debug").choices(Object.keys(subjects)))
      .action(action);
};

const subjects = {
   paths: async () => {
      // biome-ignore lint/suspicious/noConsoleLog:
      console.log("[PATHS]", {
         rootpath: getRootPath(),
         distPath: getDistPath(),
         relativeDistPath: getRelativeDistPath(),
         cwd: process.cwd(),
         dir: path.dirname(url.fileURLToPath(import.meta.url)),
         resolvedPkg: path.resolve(getRootPath(), "package.json"),
      });
   },
   routes: async () => {
      // biome-ignore lint/suspicious/noConsoleLog:
      console.log("[APP ROUTES]");
      const credentials = getConnectionCredentialsFromEnv();
      const app = createApp({ connection: credentials });
      await app.build();
      showRoutes(app.server);
   },
};

async function action(subject: string) {
   if (subject in subjects) {
      await subjects[subject]();
   } else {
      console.error("Invalid subject: ", subject);
   }
}
