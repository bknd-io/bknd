import { type Command, Option } from "commander";

export function withConfigOptions(program: Command) {
   return program
      .addOption(new Option("-c, --config <config>", "config file"))
      .addOption(
         new Option("--db-url <db>", "database url, can be any valid sqlite url").conflicts(
            "config",
         ),
      );
}

export type WithConfigOptions<CustomOptions = {}> = {
   config?: string;
   dbUrl?: string;
} & CustomOptions;
