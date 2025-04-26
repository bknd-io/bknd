import type { CliCommand } from "cli/types";
import { Option } from "commander";
import { makeAppFromEnv } from "cli/commands/run";
import { EntityTypescript } from "data/entities/EntityTypescript";
import { writeFile } from "cli/utils/sys";
import c from "picocolors";

export const types: CliCommand = (program) => {
   program
      .command("types")
      .description("generate types")
      .addOption(new Option("-o, --outfile <outfile>", "output file").default("bknd-types.d.ts"))
      .addOption(new Option("--no-write", "do not write to file").default(true))
      .action(action);
};

async function action({
   outfile,
   write,
}: {
   outfile: string;
   write: boolean;
}) {
   const app = await makeAppFromEnv({
      server: "node",
   });
   await app.build();

   const et = new EntityTypescript(app.em);

   if (write) {
      await writeFile(outfile, et.toString());
      console.info(`\nTypes written to ${c.cyan(outfile)}`);
   } else {
      console.info(et.toString());
   }
}
