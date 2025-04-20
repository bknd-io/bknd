import type { CliCommand } from "cli/types";
import { Argument } from "commander";
import { makeAppFromEnv } from "cli/commands/run";

export const types: CliCommand = (program) => {
   program.command("types").description("generate types").action(action);
};

async function action(args: any) {
   const app = await makeAppFromEnv({
      server: "node",
   });
}
