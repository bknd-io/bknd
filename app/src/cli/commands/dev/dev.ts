import type { CliCommand } from "cli/types";
import { Option } from "commander";
import { withConfigOptions, type WithConfigOptions } from "cli/utils/options";
import * as utils from "./utils";
import { $console } from "core/utils";
import { Project } from "./lib/Project";

export const dev: CliCommand = (program) =>
   withConfigOptions(program.command("dev"))
      .description("dev server")
      .addOption(new Option("--build", "build the project"))
      .action(action);

async function action(options: WithConfigOptions<{ build?: boolean }>) {
   console.log("options", options);
   const project = new Project({
      templatePath: utils.TEMPLATE_PATH,
   });

   await project.init();

   if (options.build) {
      await project.build();
      process.exit(0);
   }
   await project.listen();
}
