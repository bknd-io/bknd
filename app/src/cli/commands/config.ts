import { getDefaultConfig } from "modules/ModuleManager";
import type { CliCommand } from "../types";

export const config: CliCommand = (program) => {
   program
      .command("config")
      .description("get default config")
      .option("--pretty", "pretty print")
      .action((options) => {
         const config = getDefaultConfig();

         // biome-ignore lint/suspicious/noConsoleLog:
         console.log(options.pretty ? JSON.stringify(config, null, 2) : JSON.stringify(config));
      });
};
