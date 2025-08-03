import { $ } from "bun";
import * as tsup from "tsup";
import pkg from "./package.json" with { type: "json" };
import c from "picocolors";

const args = process.argv.slice(2);
const watch = args.includes("--watch");
const minify = args.includes("--minify");
const types = args.includes("--types");
const sourcemap = args.includes("--sourcemap");
const clean = args.includes("--clean");

// silence tsup
const oldConsole = {
   log: console.log,
   warn: console.warn,
};
console.log = () => {};
console.warn = () => {};

const define = {
   __isDev: "0",
   __version: JSON.stringify(pkg.version),
};

if (clean) {
   console.info("Cleaning dist (w/o static)");
   await $`find dist -mindepth 1 ! -path "dist/static/*" ! -path "dist/static" -exec rm -rf {} +`;
}

let types_running = false;
function buildTypes() {
   if (types_running || !types) return;
   types_running = true;

   Bun.spawn(["bun", "build:types"], {
      stdout: "inherit",
      onExit: () => {
         oldConsole.log(c.cyan("[Types]"), c.green("built"));
         Bun.spawn(["bun", "tsc-alias"], {
            stdout: "inherit",
            onExit: () => {
               oldConsole.log(c.cyan("[Types]"), c.green("aliased"));
               types_running = false;
            },
         });
      },
   });
}

if (types && !watch) {
   buildTypes();
}

let watcher_timeout: any;
function delayTypes() {
   if (!watch || !types) return;
   if (watcher_timeout) {
      clearTimeout(watcher_timeout);
   }
   watcher_timeout = setTimeout(buildTypes, 1000);
}

// collection of always-external packages
const external = [
   "bun:test",
   "node:test",
   "node:assert/strict",
   "@libsql/client",
   "bknd",
   /^bknd\/.*/,
] as const;

/**
 * Building backend and general API
 */
async function buildApi() {
   await tsup.build({
      minify,
      sourcemap,
      watch,
      define,
      entry: ["src/index.ts", "src/core/utils/index.ts", "src/plugins/index.ts"],
      outDir: "dist",
      external: [...external],
      metafile: true,
      platform: "browser",
      format: ["esm"],
      splitting: false,
      treeshake: true,
      loader: {
         ".svg": "dataurl",
      },
      onSuccess: async () => {
         delayTypes();
         oldConsole.log(c.cyan("[API]"), c.green("built"));
      },
   });
}

async function rewriteClient(path: string) {
   const bundle = await Bun.file(path).text();
   await Bun.write(path, '"use client";\n' + bundle.replaceAll("ui/client", "bknd/client"));
}

/**
 * Building UI for direct imports
 */
async function buildUi() {
   const base = {
      minify,
      sourcemap,
      watch,
      define,
      external: [
         ...external,
         "react",
         "react-dom",
         "react/jsx-runtime",
         "react/jsx-dev-runtime",
         "use-sync-external-store",
         /codemirror/,
         "@xyflow/react",
         "@mantine/core",
      ],
      metafile: true,
      platform: "browser",
      format: ["esm"],
      splitting: false,
      bundle: true,
      treeshake: true,
      loader: {
         ".svg": "dataurl",
      },
      esbuildOptions: (options) => {
         options.logLevel = "silent";
      },
   } satisfies tsup.Options;

   await tsup.build({
      ...base,
      entry: ["src/ui/index.ts", "src/ui/main.css", "src/ui/styles.css"],
      outDir: "dist/ui",
      onSuccess: async () => {
         await rewriteClient("./dist/ui/index.js");
         delayTypes();
         oldConsole.log(c.cyan("[UI]"), c.green("built"));
      },
   });

   await tsup.build({
      ...base,
      entry: ["src/ui/client/index.ts"],
      outDir: "dist/ui/client",
      onSuccess: async () => {
         await rewriteClient("./dist/ui/client/index.js");
         delayTypes();
         oldConsole.log(c.cyan("[UI]"), "Client", c.green("built"));
      },
   });
}

/**
 * Building UI Elements
 * - tailwind-merge is mocked, no exclude
 * - ui/client is external, and after built replaced with "bknd/client"
 */
async function buildUiElements() {
   await tsup.build({
      minify,
      sourcemap,
      watch,
      define,
      entry: ["src/ui/elements/index.ts"],
      outDir: "dist/ui/elements",
      external: [
         "ui/client",
         "react",
         "react-dom",
         "react/jsx-runtime",
         "react/jsx-dev-runtime",
         "use-sync-external-store",
      ],
      metafile: true,
      platform: "browser",
      format: ["esm"],
      splitting: false,
      bundle: true,
      treeshake: true,
      loader: {
         ".svg": "dataurl",
      },
      esbuildOptions: (options) => {
         options.alias = {
            // not important for elements, mock to reduce bundle
            "tailwind-merge": "./src/ui/elements/mocks/tailwind-merge.ts",
         };
      },
      onSuccess: async () => {
         await rewriteClient("./dist/ui/elements/index.js");
         delayTypes();
         oldConsole.log(c.cyan("[UI]"), "Elements", c.green("built"));
      },
   });
}

/**
 * Building adapters
 */
function baseConfig(adapter: string, overrides: Partial<tsup.Options> = {}): tsup.Options {
   return {
      minify,
      sourcemap,
      watch,
      entry: [`src/adapter/${adapter}/index.ts`],
      format: ["esm"],
      platform: "neutral",
      outDir: `dist/adapter/${adapter}`,
      metafile: true,
      splitting: false,
      onSuccess: async () => {
         delayTypes();
         oldConsole.log(c.cyan("[Adapter]"), adapter || "base", c.green("built"));
      },
      ...overrides,
      define: {
         ...define,
         ...overrides.define,
      },
      external: [
         /^cloudflare*/,
         /^@?hono.*?/,
         /^(bknd|react|next|node).*?/,
         /.*\.(html)$/,
         ...external,
         ...(Array.isArray(overrides.external) ? overrides.external : []),
      ],
   };
}

async function buildAdapters() {
   await Promise.all([
      // base adapter handles
      tsup.build({
         ...baseConfig(""),
         entry: ["src/adapter/index.ts"],
         outDir: "dist/adapter",
      }),

      // specific adatpers
      tsup.build(baseConfig("react-router")),
      tsup.build(
         baseConfig("bun", {
            external: [/^bun\:.*/],
         }),
      ),
      tsup.build(baseConfig("astro")),
      tsup.build(baseConfig("aws")),
      tsup.build(baseConfig("cloudflare")),

      tsup.build({
         ...baseConfig("vite"),
         platform: "node",
      }),

      tsup.build({
         ...baseConfig("nextjs"),
         platform: "node",
      }),

      tsup.build({
         ...baseConfig("node"),
         platform: "node",
      }),

      tsup.build({
         ...baseConfig("sqlite/edge"),
         entry: ["src/adapter/sqlite/edge.ts"],
         outDir: "dist/adapter/sqlite",
         metafile: false,
      }),

      tsup.build({
         ...baseConfig("sqlite/node"),
         entry: ["src/adapter/sqlite/node.ts"],
         outDir: "dist/adapter/sqlite",
         platform: "node",
         metafile: false,
      }),

      tsup.build({
         ...baseConfig("sqlite/bun"),
         entry: ["src/adapter/sqlite/bun.ts"],
         outDir: "dist/adapter/sqlite",
         metafile: false,
         external: [/^bun\:.*/],
      }),
   ]);
}

await Promise.all([buildApi(), buildUi(), buildUiElements(), buildAdapters()]);
