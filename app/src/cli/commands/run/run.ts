import type { Config } from "@libsql/client/node";
import { StorageLocalAdapter } from "adapter/node/storage";
import type { CliBkndConfig, CliCommand } from "cli/types";
import { Option } from "commander";
import { config, type App, type CreateAppConfig, type MaybePromise, registries } from "bknd";
import dotenv from "dotenv";
import * as errore from "errore";
import c from "picocolors";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
   PLATFORMS,
   type Platform,
   getConfigPath,
   getConnectionCredentialsFromEnv,
   serveStatic,
   startServer,
} from "./platform";
import { createRuntimeApp, makeConfig } from "bknd/adapter";
import { colorizeConsole, isBun } from "bknd/utils";
import { withConfigOptions, type WithConfigOptions } from "cli/utils/options";

class ConfigLoadError extends errore.createTaggedError({
   name: "ConfigLoadError",
   message: "Failed to load config: $reason",
}) {}

class NeedsBunError extends errore.createTaggedError({
   name: "NeedsBunError",
   message: "Config requires Bun runtime",
}) {}

class NeedsTypeStrippingError extends errore.createTaggedError({
   name: "NeedsTypeStrippingError",
   message: "Node $version needs --experimental-strip-types for .ts config",
}) {}

class ReexecFailedError extends errore.createTaggedError({
   name: "ReexecFailedError",
   message: "Re-exec failed: $reason",
}) {}

const env_files = [".env", ".dev.vars"];
dotenv.config({
   path: env_files.map((file) => path.resolve(process.cwd(), file)),
});
const is_bun = isBun();

export const run: CliCommand = (program) => {
   withConfigOptions(program.command("run"))
      .description("run an instance")
      .addOption(
         new Option("-p, --port <port>", "port to run on")
            .env("PORT")
            .default(config.server.default_port)
            .argParser((v) => Number.parseInt(v)),
      )
      .addOption(
         new Option("-m, --memory", "use in-memory database").conflicts([
            "config",
            "db-url",
            "db-token",
         ]),
      )
      .addOption(
         new Option("--server <server>", "server type")
            .choices(PLATFORMS)
            .default(is_bun ? "bun" : "node"),
      )
      .addOption(new Option("--no-open", "don't open browser window on start"))
      .action(action);
};

// automatically register local adapter
const local = StorageLocalAdapter.prototype.getName();
if (!registries.media.has(local)) {
   registries.media.register(local, StorageLocalAdapter);
}

function needsTypeStripping(configFilePath: string): boolean {
   if (!/\.[mc]?ts$/.test(configFilePath)) return false;
   const [major, minor] = process.versions.node.split(".").map(Number);
   // Node v22.06 introduced experimental TypeScript support via strip types.
   return major === 22 && minor! < 18 && minor! > 5;
}

function reexecWithTypeStripping(): ReexecFailedError | never {
   if (process.env.__BKND_REEXEC) {
      return new ReexecFailedError({
         reason: "TS config still failed after re-exec with --experimental-strip-types",
      });
   }

   const cliPath = path.resolve(process.argv[1]!);
   const args = ["--experimental-strip-types", cliPath, ...process.argv.slice(2)];

   console.info(
      c.yellow("Node <22.18 detected, re-executing with --experimental-strip-types"),
   );

   const result = errore.try({
      try: () =>
         execFileSync(process.execPath, args, {
            stdio: "inherit",
            env: { ...process.env, __BKND_REEXEC: "1" },
         }),
      catch: (e) =>
         new ReexecFailedError({
            reason: "Failed to re-exec with --experimental-strip-types",
            cause: e,
         }),
   });

   if (result instanceof Error) return result;
   process.exit(0);
}

async function loadConfigFile(
   configFilePath: string,
): Promise<ConfigLoadError | NeedsBunError | NeedsTypeStrippingError | CliBkndConfig> {
   if (needsTypeStripping(configFilePath) && !process.execArgv.includes("--experimental-strip-types")) {
      return new NeedsTypeStrippingError({
         version: process.versions.node,
      });
   }

   const result = await errore.tryAsync({
      try: () => import(configFilePath).then((m) => m.default as CliBkndConfig),
      catch: (e) => {
         const needsBun =
            (e instanceof ReferenceError && /\bBun\b.*not defined/.test(e.message)) ||
            (e instanceof Error && "code" in e && e.code === "ERR_UNSUPPORTED_ESM_URL_SCHEME" && /bun:/.test(e.message));
         if (needsBun) return new NeedsBunError();
         return new ConfigLoadError({
            reason: e instanceof Error ? e.message : String(e),
            cause: e,
         });
      },
   });

   return result;
}

function reexecUnderBun(): ReexecFailedError | never {
   if (process.env.__BKND_REEXEC) {
      return new ReexecFailedError({
         reason: "Config requires Bun but still failed under Bun runtime",
      });
   }

   const bunPath = process.env.BUN_INSTALL
      ? path.join(process.env.BUN_INSTALL, "bin", "bun")
      : "bun";

   const cliPath = path.resolve(process.argv[1]!);
   const args = [cliPath, ...process.argv.slice(2)];

   console.info(
      c.yellow("Config requires Bun runtime, re-executing:"),
      c.cyan(`bun ${args.join(" ")}`),
   );

   const result = errore.try({
      try: () =>
         execFileSync(bunPath, args, {
            stdio: "inherit",
            env: { ...process.env, __BKND_REEXEC: "1" },
         }),
      catch: (e) =>
         new ReexecFailedError({
            reason: "Could not re-exec under Bun. Install Bun (https://bun.sh) or use bknd/adapter/node in your config.",
            cause: e,
         }),
   });

   if (result instanceof Error) return result;
   process.exit(0);
}

type MakeAppConfig = {
   connection?: CreateAppConfig["connection"];
   server?: { platform?: Platform };
   setAdminHtml?: boolean;
   onBuilt?: (app: App) => MaybePromise<void>;
};

async function makeApp(config: MakeAppConfig) {
   return await createRuntimeApp({
      serveStatic: await serveStatic(config.server?.platform ?? "node"),
      ...config,
   });
}

export async function makeConfigApp(_config: CliBkndConfig, platform?: Platform) {
   const config = await makeConfig(_config, process.env);
   return makeApp({
      ...config,
      server: { platform },
   });
}

type RunOptions = WithConfigOptions<{
   port: number;
   memory?: boolean;
   config?: string;
   dbUrl?: string;
   server: Platform;
   open?: boolean;
}>;

export async function makeAppFromEnv(options: Partial<RunOptions> = {}) {
   const configFilePath = await getConfigPath(options.config);

   let app: App | undefined = undefined;
   // first start from arguments if given
   if (options.dbUrl) {
      console.info("Using connection from", c.cyan("--db-url"), c.cyan(options.dbUrl));
      const connection = options.dbUrl ? { url: options.dbUrl } : undefined;
      app = await makeApp({ connection, server: { platform: options.server } });

      // check configuration file to be present
   } else if (configFilePath) {
      console.info("Using config from", c.cyan(configFilePath));
      const configResult = await loadConfigFile(configFilePath);

      if (configResult instanceof Error) {
         errore.matchError(configResult, {
            NeedsTypeStrippingError: () => {
               const reexecResult = reexecWithTypeStripping();
               // only reached on failure — success calls process.exit(0)
               console.error(c.red(reexecResult.message));
               process.exit(1);
            },
            NeedsBunError: () => {
               const reexecResult = reexecUnderBun();
               // only reached on failure — success calls process.exit(0)
               console.error(c.red(reexecResult.message));
               process.exit(1);
            },
            ConfigLoadError: (e) => {
               console.error(c.red("Failed to load config:"), e.reason);
               process.exit(1);
            },
            Error: (e) => {
               console.error(c.red("Failed to load config:"), e.message);
               process.exit(1);
            },
         });
      } else {
         app = await makeConfigApp(configResult, options.server);
      }

      // try to use an in-memory connection
   } else if (options.memory) {
      console.info("Using", c.cyan("in-memory"), "connection");
      app = await makeApp({
         server: { platform: options.server },
         connection: { url: ":memory:" },
      });

      // finally try to use env variables
   } else {
      const credentials = getConnectionCredentialsFromEnv();
      if (credentials) {
         console.info("Using connection from env", c.cyan(credentials.url));
         app = await makeConfigApp({ app: { connection: credentials } }, options.server);
      }
   }

   // if nothing helps, create a file based app
   if (!app) {
      const connection = { url: "file:data.db" } as Config;
      console.info("Using fallback connection", c.cyan(connection.url));
      app = await makeApp({
         connection,
         server: { platform: options.server },
      });
   }

   return app;
}

async function action(options: RunOptions) {
   colorizeConsole(console);

   const app = await makeAppFromEnv(options);
   await startServer(options.server, app, { port: options.port, open: options.open });
}
