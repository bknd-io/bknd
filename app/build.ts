import { $ } from "bun";
import * as tsup from "tsup";

const args = process.argv.slice(2);
const watch = args.includes("--watch");
const minify = args.includes("--minify");
const types = args.includes("--types");
const sourcemap = args.includes("--sourcemap");
const clean = args.includes("--clean");

if (clean) {
   console.log("Cleaning dist (w/o static)");
   await $`find dist -mindepth 1 ! -path "dist/static/*" ! -path "dist/static" -exec rm -rf {} +`;
}

let types_running = false;
function buildTypes() {
   if (types_running || !types) return;
   types_running = true;

   Bun.spawn(["bun", "build:types"], {
      stdout: "inherit",
      onExit: () => {
         console.log("Types built");
         Bun.spawn(["bun", "tsc-alias"], {
            stdout: "inherit",
            onExit: () => {
               console.log("Types aliased");
               types_running = false;
            },
         });
      },
   });
}

let watcher_timeout: any;
function delayTypes() {
   if (!watch || !types) return;
   if (watcher_timeout) {
      clearTimeout(watcher_timeout);
   }
   watcher_timeout = setTimeout(buildTypes, 1000);
}

if (types && !watch) {
   buildTypes();
}

function banner(title: string) {
   console.log("");
   console.log("=".repeat(40));
   console.log(title.toUpperCase());
   console.log("-".repeat(40));
}

/**
 * Building backend and general API
 */
async function buildApi() {
   banner("Building API");
   await tsup.build({
      minify,
      sourcemap,
      watch,
      entry: ["src/index.ts", "src/data/index.ts", "src/core/index.ts", "src/core/utils/index.ts"],
      outDir: "dist",
      external: ["bun:test", "@libsql/client"],
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
      external: [
         "bun:test",
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

   banner("Building UI");
   await tsup.build({
      ...base,
      entry: ["src/ui/index.ts", "src/ui/main.css", "src/ui/styles.css"],
      outDir: "dist/ui",
      onSuccess: async () => {
         await rewriteClient("./dist/ui/index.js");
         delayTypes();
      },
   });

   banner("Building Client");
   await tsup.build({
      ...base,
      entry: ["src/ui/client/index.ts"],
      outDir: "dist/ui/client",
      onSuccess: async () => {
         await rewriteClient("./dist/ui/client/index.js");
         delayTypes();
      },
   });
}

/**
 * Building UI Elements
 * - tailwind-merge is mocked, no exclude
 * - ui/client is external, and after built replaced with "bknd/client"
 */
async function buildUiElements() {
   banner("Building UI Elements");
   await tsup.build({
      minify,
      sourcemap,
      watch,
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
      },
      ...overrides,
      define: {
         __isDev: "0",
         ...overrides.define,
      },
      external: [
         /^cloudflare*/,
         /^@?(hono|libsql).*?/,
         /^(bknd|react|next|node).*?/,
         /.*\.(html)$/,
         ...(Array.isArray(overrides.external) ? overrides.external : []),
      ],
   };
}

async function buildAdapters() {
   banner("Building Adapters");
   // base adapter handles
   await tsup.build({
      ...baseConfig(""),
      entry: ["src/adapter/index.ts"],
      outDir: "dist/adapter",
   });

   // specific adatpers
   await tsup.build(baseConfig("remix"));
   await tsup.build(baseConfig("bun"));
   await tsup.build(baseConfig("astro"));
   await tsup.build(baseConfig("aws"));
   await tsup.build(
      baseConfig("cloudflare", {
         external: [/^kysely/],
      }),
   );

   await tsup.build({
      ...baseConfig("vite"),
      platform: "node",
   });

   await tsup.build({
      ...baseConfig("nextjs"),
      platform: "node",
   });

   await tsup.build({
      ...baseConfig("node"),
      platform: "node",
   });
}

await buildApi();
await buildUi();
await buildUiElements();
await buildAdapters();
