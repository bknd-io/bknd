import { getRelativeDistPath } from "cli/utils/sys";
import type { CliCommand } from "../types";
import { Option } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import c from "picocolors";

export const copyAssets: CliCommand = (program) => {
   program
      .command("copy-assets")
      .description("copy static assets")
      .addOption(new Option("-o --out <directory>", "directory to copy to"))
      .addOption(new Option("-c --clean", "clean the output directory"))
      .action(action);
};

async function action(options: { out?: string; clean?: boolean }) {
   const out = options.out ?? "static";

   // clean "out" directory
   if (options.clean) {
      await fs.rm(out, { recursive: true, force: true });
   }

   // recursively copy from src/assets to out using node fs
   const from = path.resolve(getRelativeDistPath(), "static");
   await fs.cp(from, out, { recursive: true });

   // in out, move ".vite/manifest.json" to "manifest.json"
   await fs.rename(path.resolve(out, ".vite/manifest.json"), path.resolve(out, "manifest.json"));

   // delete ".vite" directory in out
   await fs.rm(path.resolve(out, ".vite"), { recursive: true });

   // biome-ignore lint/suspicious/noConsoleLog:
   console.log(c.green(`Assets copied to: ${c.bold(out)}`));
}
