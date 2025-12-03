import type { CliCommand } from "cli/types";
import { withConfigOptions, type WithConfigOptions } from "cli/utils/options";
import * as utils from "./utils";
import { $console } from "core/utils";
import { Project } from "./lib/Project";

export const dev: CliCommand = (program) =>
   withConfigOptions(program.command("dev")).description("dev server").action(action);

async function action(options: WithConfigOptions<{}>) {
   const project = new Project({
      templatePath: utils.TEMPLATE_PATH,
   });

   await project.init();
   await project.listen();
}
