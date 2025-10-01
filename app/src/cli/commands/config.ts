import { getDefaultConfig } from "modules/ModuleManager";
import type { CliCommand } from "../types";
import { makeAppFromEnv } from "cli/commands/run";
import { writeFile } from "node:fs/promises";
import c from "picocolors";
import { withConfigOptions } from "cli/utils/options";
import { $console } from "bknd/utils";

export const config: CliCommand = (program) => {
   withConfigOptions(program.command("config"))
      .description("get app config")
      .option("--pretty", "pretty print")
      .option("--default", "use default config")
      .option("--secrets", "include secrets in output")
      .option("--out <file>", "output file")
      .action(async (options) => {
         let config: any = {};

         if (options.default) {
            config = getDefaultConfig();
         } else {
            const app = await makeAppFromEnv(options);
            const manager = app.modules;

            if (options.secrets) {
               $console.warn("Including secrets in output");
               config = manager.toJSON(true);
            } else {
               config = manager.extractSecrets().configs;
            }
         }

         config = options.pretty ? JSON.stringify(config, null, 2) : JSON.stringify(config);

         console.info("");
         if (options.out) {
            await writeFile(options.out, config);
            console.info(`Config written to ${c.cyan(options.out)}`);
         } else {
            console.info(JSON.parse(config));
         }

         process.exit(0);
      });
};
