#!/usr/bin/env node

import { Command } from "commander";
import color from "picocolors";
import * as commands from "./commands";
import { getVersion } from "./utils/sys";
import { capture, flush, init } from "cli/utils/telemetry";
const program = new Command();

async function main() {
   await init();
   capture("start");

   const version = await getVersion();
   program
      .name("bknd")
      .description(color.yellowBright("⚡") + " bknd cli " + color.bold(color.cyan(`v${version}`)))
      .version(version)
      .hook("preAction", (thisCommand, actionCommand) => {
         capture(`cmd_${actionCommand.name()}`);
      })
      .hook("postAction", async () => {
         await flush();
      });

   // register commands
   for (const command of Object.values(commands)) {
      command(program);
   }

   await program.parseAsync();
}

main()
   .then(null)
   .catch(async (e) => {
      await flush();
      console.error(e);
   });
