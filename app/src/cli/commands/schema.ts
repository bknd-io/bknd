import { getDefaultSchema } from "modules/ModuleManager";
import type { CliCommand } from "../types";

export const schema: CliCommand = (program) => {
   program
      .command("schema")
      .description("get schema")
      .option("--pretty", "pretty print")
      .action((options) => {
         const schema = getDefaultSchema();
         console.info(options.pretty ? JSON.stringify(schema, null, 2) : JSON.stringify(schema));
         process.exit(0);
      });
};
