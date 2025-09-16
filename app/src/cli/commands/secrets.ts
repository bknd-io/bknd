import type { CliCommand } from "../types";
import { makeAppFromEnv } from "cli/commands/run";
import { writeFile } from "node:fs/promises";
import c from "picocolors";
import { withConfigOptions, type WithConfigOptions } from "cli/utils/options";
import { transformObject } from "bknd/utils";
import { Option } from "commander";

export const secrets: CliCommand = (program) => {
   withConfigOptions(program.command("secrets"))
      .description("get app secrets")
      .option("--template", "template output without the actual secrets")
      .addOption(
         new Option("--format <format>", "format output").choices(["json", "env"]).default("json"),
      )
      .option("--out <file>", "output file")
      .action(
         async (
            options: WithConfigOptions<{ template: string; format: "json" | "env"; out: string }>,
         ) => {
            const app = await makeAppFromEnv(options);
            const manager = app.modules;

            let secrets = manager.extractSecrets().secrets;
            if (options.template) {
               secrets = transformObject(secrets, () => "");
            }

            console.info("");
            if (options.out) {
               if (options.format === "env") {
                  await writeFile(
                     options.out,
                     Object.entries(secrets)
                        .map(([key, value]) => `${key}=${value}`)
                        .join("\n"),
                  );
               } else {
                  await writeFile(options.out, JSON.stringify(secrets, null, 2));
               }
               console.info(`Secrets written to ${c.cyan(options.out)}`);
            } else {
               if (options.format === "env") {
                  console.info(
                     c.cyan(
                        Object.entries(secrets)
                           .map(([key, value]) => `${key}=${value}`)
                           .join("\n"),
                     ),
                  );
               } else {
                  console.info(secrets);
               }
            }
            console.info("");
            process.exit(0);
         },
      );
};
