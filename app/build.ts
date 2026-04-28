import { build, type UserConfig } from "tsdown";
import pkg from "./package.json" with { type: "json" };
import c from "picocolors";
import { watch as fsWatch, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildTypes as runTypesBuild } from "./build.types";

const args = process.argv.slice(2);
const watch = args.includes("--watch");
const minify = args.includes("--minify");
const types = args.includes("--types");
const sourcemap = args.includes("--sourcemap");
const clean = args.includes("--clean");
const dev = args.includes("--dev");

// silence tsdown
const oldConsole = {
   log: console.log,
   warn: console.warn,
};
console.log = () => { };
console.warn = () => { };

const define = {
   __isDev: "0",
   __version: JSON.stringify(pkg.version),
};

if (clean) {
   console.info("Cleaning dist (w/o static)");
   // Cross-platform clean: remove all files/folders in dist except static
   const distPath = join(import.meta.dir, "dist");
   try {
      const entries = readdirSync(distPath);
      for (const entry of entries) {
         if (entry === "static") continue;
         const entryPath = join(distPath, entry);
         rmSync(entryPath, { recursive: true, force: true });
      }
   } catch {
      // dist may not exist yet, ignore
   }
}

let types_running = false;
async function buildTypes() {
   if (types_running || !types) return;
   types_running = true;

   try {
      await runTypesBuild();
      oldConsole.log(c.cyan("[Types]"), c.green("built"));
   } finally {
      types_running = false;
   }
}

let watcher_timeout: any;
function delayTypes(delayTime = 1000) {
   if (!watch || !types) return;
   if (watcher_timeout) {
      clearTimeout(watcher_timeout);
   }
   watcher_timeout = setTimeout(() => {
      void buildTypes().catch((error) => {
         oldConsole.warn(c.cyan("[Types]"), c.red("build failed"), error);
      });
   }, delayTime);
}

const dependencies = Object.keys(pkg.dependencies);

// collection of always-neverBundle packages
const neverBundle = [
   ...dependencies,
   "bun:test",
   "node:test",
   "node:assert/strict",
   "@libsql/client",
   "bknd",
   /^bknd\/.*/,
   "jsonv-ts",
   /^jsonv-ts\/.*/,
] as const;

/**
 * Building backend and general API
 */
async function buildApi() {
   await build({
      minify,
      sourcemap,
      // don't use tsdown's broken watch, we'll handle it ourselves
      watch: false,
      dts: false,
      define,
      entry: [
         "src/index.ts",
         "src/core/utils/index.ts",
         "src/plugins/index.ts",
         "src/modes/index.ts",
      ],
      unbundle: false,
      outDir: "dist",
      deps: {
         neverBundle: [
            ...neverBundle
         ],
      },

      target: "esnext",
      platform: "browser",
      nodeProtocol: true,
      format: "esm",

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
      watch: false,
      dts: false,
      define,
      deps: {
         neverBundle: [
            ...neverBundle,
            "react",
            "react-dom",
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
            "use-sync-external-store",
            /codemirror/,
            "@xyflow/react",
            "@mantine/core",
         ],
      },
      devtools: dev,
      platform: "browser",
      format: "esm",
      unbundle: false,
      treeshake: true,
      loader: {
         ".svg": "dataurl",
      },

      logLevel: "silent",
   } satisfies UserConfig;



   await Promise.all([
      build({
         ...base,
         entry: ["src/ui/index.ts", "src/ui/main.css", "src/ui/styles.css"],
         outDir: "dist/ui",
         onSuccess: async () => {
            await rewriteClient("./dist/ui/index.js");
            delayTypes();
            oldConsole.log(c.cyan("[UI]"), c.green("built"));
         },
      }),

      build({
         ...base,
         entry: ["src/ui/client/index.ts"],
         outDir: "dist/ui/client",
         onSuccess: async () => {
            await rewriteClient("./dist/ui/client/index.js");
            delayTypes();
            oldConsole.log(c.cyan("[UI]"), "Client", c.green("built"));
         },
      }),
   ]);
}

/**
 * Building UI Elements
 * - tailwind-merge is mocked, no exclude
 * - ui/client is external, and after built replaced with "bknd/client"
 */
async function buildUiElements() {
   await build({
      minify,
      sourcemap,
      watch: false,
      dts: false,
      define,
      entry: ["src/ui/elements/index.ts"],
      outDir: "dist/ui/elements",
      deps: {
         neverBundle: [
            "ui/client",
            "bknd",
            /^bknd\/.*/,
            "wouter",
            "react",
            "react-dom",
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
            "use-sync-external-store",
         ],
      },
      platform: "browser",
      format: "esm",
      bundle: true,
      treeshake: true,
      loader: {
         ".svg": "dataurl",
      },
      alias: {
         // not important for elements, mock to reduce bundle
         "tailwind-merge": resolve(import.meta.dir, "src/ui/elements/mocks/tailwind-merge.ts"),
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
function baseConfig(adapter: string, overrides: Partial<UserConfig> = {}): UserConfig {
   return {
      minify,
      sourcemap,
      watch: false,
      dts: false,
      entry: [`src/adapter/${adapter}/index.ts`],
      format: "esm",
      platform: "neutral",
      outDir: `dist/adapter/${adapter}`,
      devtools: dev,
      nodeProtocol: true,
      onSuccess: async () => {
         delayTypes();
         oldConsole.log(c.cyan("[Adapter]"), adapter || "base", c.green("built"));
      },
      ...overrides,
      define: {
         ...define,
         ...overrides.define,
      },
      deps: {
         neverBundle: [
            /^cloudflare*/,
            /^@?hono.*?/,
            /^(bknd|react|next|node).*?/,
            /.*\.(html)$/,
            ...neverBundle,
            ...(Array.isArray(overrides.deps?.neverBundle) ? overrides.deps.neverBundle : []),
         ],
      },
   };
}

async function buildAdapters() {
   await Promise.all([
      // base adapter handles
      build({
         ...baseConfig(""),
         target: "esnext",
         platform: "neutral",
         entry: ["src/adapter/index.ts"],
         outDir: "dist/adapter",
         // only way to keep @vite-ignore comments
         minify: false,
         dts: false,
      }),

      // specific adapters
      build(baseConfig("react-router")),
      build(
         baseConfig("browser", {
            deps: {
               neverBundle: [/^sqlocal\/?.*?/, "wouter"],
            },
         }),
      ),
      build(
         baseConfig("bun", {
            deps: {
               neverBundle: [/^bun:.*/],
            },
         }),
      ),
      build(baseConfig("astro")),
      build(baseConfig("aws")),
      build(
         baseConfig("cloudflare", {
            deps: {
               neverBundle: ["wrangler", "node:process", "miniflare"],
            },
         }),
      ),
      build(
         baseConfig("cloudflare/proxy", {
            target: "esnext",
            entry: ["src/adapter/cloudflare/proxy.ts"],
            outDir: "dist/adapter/cloudflare",
            devtools: false,
            deps: {
               neverBundle: [/bknd/, "wrangler", "node:process", "miniflare"],
            },
         }),
      ),

      build({
         ...baseConfig("vite"),
         platform: "node",
      }),

      build({
         ...baseConfig("nextjs"),
         platform: "node",
      }),

      build({
         ...baseConfig("tanstack-start"),
         platform: "node",
      }),

      build({
         ...baseConfig("sveltekit"),
         platform: "node",
      }),

      build({
         ...baseConfig("nuxt"),
         platform: "node",
      }),

      build({
         ...baseConfig("node"),
         platform: "node",
      }),

      build({
         ...baseConfig("sqlite/edge"),
         entry: ["src/adapter/sqlite/edge.ts"],
         outDir: "dist/adapter/sqlite",
         devtools: false,
      }),

      build({
         ...baseConfig("sqlite/node"),
         entry: ["src/adapter/sqlite/node.ts"],
         outDir: "dist/adapter/sqlite",
         platform: "node",
         devtools: false,
      }),

      build({
         ...baseConfig("sqlite/bun"),
         entry: ["src/adapter/sqlite/bun.ts"],
         outDir: "dist/adapter/sqlite",
         devtools: false,
         deps: {
            neverBundle: [/^bun:.*/],
         },
      }),
   ]);
}

const buildPipeline = [buildApi, buildUi, buildUiElements, buildAdapters];

// Run type generation in parallel, since it can be slow and doesn't block the main build
if (types) {
   buildPipeline.push(async () => await buildTypes());
}

// initial build
await buildAll();

async function buildAll() {
   await Promise.all(buildPipeline.map(fn => fn()));
}


// custom watcher since tsdown's watch is broken in v0.21.7
if (watch) {
   oldConsole.log(c.cyan("[Watch]"), "watching for changes in src/...");

   let debounceTimer: ReturnType<typeof setTimeout> | null = null;
   let isBuilding = false;

   const rebuild = async () => {
      if (isBuilding) return;
      isBuilding = true;
      oldConsole.log(c.cyan("[Watch]"), "rebuilding...");
      try {
         await buildAll();
         oldConsole.log(c.cyan("[Watch]"), c.green("done"));
      } catch (e) {
         oldConsole.warn(c.cyan("[Watch]"), c.red("build failed"), e);
      }
      isBuilding = false;
   };

   const debouncedRebuild = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(rebuild, 100);
   };

   // watch src directory recursively
   fsWatch(join(import.meta.dir, "src"), { recursive: true }, (event, filename) => {
      if (!filename) return;
      // ignore non-source files
      if (!filename.endsWith(".ts") && !filename.endsWith(".tsx") && !filename.endsWith(".css"))
         return;
      oldConsole.log(c.cyan("[Watch]"), c.dim(`${event}: ${filename}`));
      debouncedRebuild();
   });

   // keep process alive
   await new Promise(() => { });
}
