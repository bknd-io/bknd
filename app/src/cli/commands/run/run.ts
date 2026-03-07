import type { Config } from "@libsql/client/node";
import { StorageLocalAdapter } from "adapter/node/storage";
import type { CliBkndConfig, CliCommand } from "cli/types";
import { Option } from "commander";
import { config, type App, type CreateAppConfig, type MaybePromise, registries } from "bknd";
import dotenv from "dotenv";
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
   return major === 22 && minor! < 18;
}

function reexecWithTypeStripping(): never {
   if (process.env.__BKND_REEXEC) {
      console.error(c.red("TS config still failed after re-exec with --experimental-strip-types."));
      process.exit(1);
   }

   const cliPath = path.resolve(process.argv[1]!);
   const args = ["--experimental-strip-types", cliPath, ...process.argv.slice(2)];

   console.info(
      c.yellow("Node <22.18 detected, re-executing with --experimental-strip-types"),
   );

   try {
      execFileSync(process.execPath, args, {
         stdio: "inherit",
         env: { ...process.env, __BKND_REEXEC: "1" },
      });
      process.exit(0);
   } catch (e: any) {
      if (e.status != null) process.exit(e.status);
      console.error(c.red("Failed to re-exec with --experimental-strip-types."));
      process.exit(1);
   }
}

async function loadConfigFile(configFilePath: string): Promise<CliBkndConfig> {
   if (needsTypeStripping(configFilePath) && !process.execArgv.includes("--experimental-strip-types")) {
      reexecWithTypeStripping();
   }
   return (await import(configFilePath).then((m) => m.default)) as CliBkndConfig;
}

function reexecUnderBun(): never {
   if (process.env.__BKND_REEXEC) {
      console.error(c.red("Config requires Bun but still failed under Bun runtime."));
      process.exit(1);
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

   try {
      execFileSync(bunPath, args, {
         stdio: "inherit",
         env: { ...process.env, __BKND_REEXEC: "1" },
      });
      process.exit(0);
   } catch (e: any) {
      if (e.status != null) {
         process.exit(e.status);
      }
      console.error(
         c.red("Could not re-exec under Bun."),
         "Install Bun (https://bun.sh) or use bknd/adapter/node in your config.",
      );
      process.exit(1);
   }
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
      try {
         const config = await loadConfigFile(configFilePath);
         app = await makeConfigApp(config, options.server);
      } catch (e) {
         if (e instanceof ReferenceError && /\bBun\b.*not defined/.test(e.message)) {
            reexecUnderBun();
         }
         console.error("Failed to load config:", e);
         process.exit(1);
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
