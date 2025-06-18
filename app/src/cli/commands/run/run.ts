import type { Config } from "@libsql/client/node";
import type { App, CreateAppConfig } from "App";
import { StorageLocalAdapter } from "adapter/node/storage";
import type { CliBkndConfig, CliCommand } from "cli/types";
import { Option } from "commander";
import { colorizeConsole, config } from "core";
import dotenv from "dotenv";
import { registries } from "modules/registries";
import c from "picocolors";
import path from "node:path";
import {
   PLATFORMS,
   type Platform,
   getConfigPath,
   getConnectionCredentialsFromEnv,
   serveStatic,
   startServer,
} from "./platform";
import { createRuntimeApp, makeConfig } from "adapter";
import { isBun } from "core/utils";

const env_files = [".env", ".dev.vars"];
dotenv.config({
   path: env_files.map((file) => path.resolve(process.cwd(), file)),
});
const is_bun = isBun();

export const run: CliCommand = (program) => {
   program
      .command("run")
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
      .addOption(new Option("-c, --config <config>", "config file"))
      .addOption(
         new Option("--db-url <db>", "database url, can be any valid sqlite url").conflicts(
            "config",
         ),
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

type MakeAppConfig = {
   connection?: CreateAppConfig["connection"];
   server?: { platform?: Platform };
   setAdminHtml?: boolean;
   onBuilt?: (app: App) => Promise<void>;
};

async function makeApp(config: MakeAppConfig) {
   return await createRuntimeApp({
      serveStatic: await serveStatic(config.server?.platform ?? "node"),
      ...config,
   });
}

export async function makeConfigApp(_config: CliBkndConfig, platform?: Platform) {
   const config = makeConfig(_config, process.env);
   return makeApp({
      ...config,
      server: { platform },
   });
}

type RunOptions = {
   port: number;
   memory?: boolean;
   config?: string;
   dbUrl?: string;
   server: Platform;
   open?: boolean;
};

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
         const config = (await import(configFilePath).then((m) => m.default)) as CliBkndConfig;
         app = await makeConfigApp(config, options.server);
      } catch (e) {
         console.error("Failed to load config:", e);
         process.exit(1);
      }

      // try to use an in-memory connection
   } else if (options.memory) {
      console.info("Using", c.cyan("in-memory"), "connection");
      app = await makeApp({ server: { platform: options.server } });

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
