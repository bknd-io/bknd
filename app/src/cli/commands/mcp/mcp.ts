import type { CliCommand } from "cli/types";
import { makeAppFromEnv } from "../run";
import { getSystemMcp } from "modules/server/system-mcp";
import { $console } from "bknd/utils";
import { stdioTransport } from "jsonv-ts/mcp";

export const mcp: CliCommand = (program) =>
   program
      .command("mcp")
      .description("mcp server stdio transport")
      .option("--config <config>", "config file")
      .option("--db-url <db>", "database url, can be any valid sqlite url")
      .option(
         "--token <token>",
         "token to authenticate requests, if not provided, uses BEARER_TOKEN environment variable",
      )
      .option("--verbose", "verbose output")
      .option("--log-level <level>", "log level")
      .option("--force", "force enable mcp")
      .action(action);

async function action(options: {
   verbose?: boolean;
   config?: string;
   dbUrl?: string;
   token?: string;
   logLevel?: string;
   force?: boolean;
}) {
   const verbose = !!options.verbose;
   const __oldConsole = { ...console };

   // disable console
   if (!verbose) {
      $console.disable();
      Object.entries(console).forEach(([key]) => {
         console[key] = () => null;
      });
   }

   const app = await makeAppFromEnv({
      config: options.config,
      dbUrl: options.dbUrl,
      server: "node",
   });

   if (!app.modules.get("server").config.mcp.enabled && !options.force) {
      $console.enable();
      Object.assign(console, __oldConsole);
      console.error("MCP is not enabled in the config, use --force to enable it");
      process.exit(1);
   }

   const token = options.token || process.env.BEARER_TOKEN;
   const server = getSystemMcp(app);

   if (verbose) {
      console.info(
         `\n⚙️  Tools (${server.tools.length}):\n${server.tools.map((t) => `- ${t.name}`).join("\n")}\n`,
      );
      console.info(
         `📚 Resources (${server.resources.length}):\n${server.resources.map((r) => `- ${r.name}`).join("\n")}`,
      );
      console.info("\nMCP server is running on STDIO transport");
   }

   if (options.logLevel) {
      server.setLogLevel(options.logLevel as any);
   }

   const stdout = process.stdout;
   const stdin = process.stdin;
   const stderr = process.stderr;

   {
      using transport = stdioTransport(server, {
         stdin,
         stdout,
         stderr,
         raw: new Request("https://localhost", {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
         }),
      });
   }
}
