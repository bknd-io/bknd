import type { CliCommand } from "cli/types";
import { Option } from "commander";
import { makeAppFromEnv } from "cli/commands/run";
import { EntityTypescript } from "data/entities/EntityTypescript";
import { writeFile } from "cli/utils/sys";
import c from "picocolors";
import { withConfigOptions, type WithConfigOptions } from "cli/utils/options";

export const types: CliCommand = (program) => {
   withConfigOptions(program.command("types"))
      .description("generate types")
      .addOption(new Option("-o, --outfile <outfile>", "output file").default("bknd-types.d.ts"))
      .addOption(new Option("--dump", "dump types to console instead of writing to file"))
      .action(action);
};

async function action({
   outfile,
   dump,
   ...options
}: WithConfigOptions<{
   outfile: string;
   dump: boolean;
}>) {
   const app = await makeAppFromEnv({
      server: "node",
      ...options,
   });

   const et = new EntityTypescript(app.em);

   if (dump) {
      console.info(et.toString());
   } else {
      await writeFile(outfile, et.toString());
      console.info(`\nTypes written to ${c.cyan(outfile)}`);
   }
}
