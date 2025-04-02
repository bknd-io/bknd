import type { BkndConfig } from "adapter";
import type { Command } from "commander";

export type CliCommand = (program: Command) => void;

export type CliBkndConfig<Env = any> = BkndConfig & {
   server?: {
      port?: number;
      platform?: "node" | "bun";
   };
};
