import { getDefaultConfig } from "modules/ModuleManager";
import type { CliCommand } from "../types";
import { makeAppFromEnv } from "cli/commands/run";
import { writeFile } from "node:fs/promises";
import c from "picocolors";

export const config: CliCommand = (program) => {
   program
      .command("config")
      .description("get app config")
      .option("--pretty", "pretty print")
      .option("--default", "use default config")
      .option("--secrets", "include secrets in output")
      .option("--config <config>", "config file")
      .option("--db-url <db>", "database url, can be any valid sqlite url")
      .option("--out <file>", "output file")
      .action(async (options) => {
         let config: any = {};

         if (options.default) {
            config = getDefaultConfig();
         } else {
            const app = await makeAppFromEnv(options);
            config = app.toJSON(options.secrets);
         }

         config = options.pretty ? JSON.stringify(config, null, 2) : JSON.stringify(config);

         console.info("");
         if (options.out) {
            await writeFile(options.out, config);
            console.info(`Config written to ${c.cyan(options.out)}`);
         } else {
            console.info(JSON.parse(config));
         }
      });
};
