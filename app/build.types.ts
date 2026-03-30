import { build } from "tsdown";
import c from "picocolors";

// const typeEntryGroups = [
//    [
//       "src/index.ts",
//       "src/core/utils/index.ts",
//       "src/plugins/index.ts",
//       "src/modes/index.ts",
//       "src/cli/index.ts",
//    ],
//    ["src/ui/index.ts", "src/ui/client/index.ts", "src/ui/elements/index.ts"],
//    [
//       "src/adapter/index.ts",
//       "src/adapter/react-router/index.ts",
//       "src/adapter/browser/index.ts",
//       "src/adapter/bun/index.ts",
//       "src/adapter/astro/index.ts",
//       "src/adapter/aws/index.ts",
//       "src/adapter/cloudflare/index.ts",
//       "src/adapter/cloudflare/proxy.ts",
//       "src/adapter/vite/index.ts",
//       "src/adapter/nextjs/index.ts",
//       "src/adapter/tanstack-start/index.ts",
//       "src/adapter/sveltekit/index.ts",
//       "src/adapter/nuxt/index.ts",
//       "src/adapter/node/index.ts",
//       "src/adapter/sqlite/edge.ts",
//       "src/adapter/sqlite/node.ts",
//       "src/adapter/sqlite/bun.ts",
//    ],
// ] as const;

export async function buildTypes() {
//    for (const entry of typeEntryGroups) {
      await build({
        //  entry: [...entry],
         root: "src",
         outDir: "dist/types",
         format: ["esm"],
         tsconfig: "tsconfig.build.json",
         watch: false,
         clean: true,
         logLevel: "silent",
         dts: {
            emitDtsOnly: true,
            resolver: "oxc",
         },
      });
//    }
}

if (import.meta.main) {
   try {
      await buildTypes();
      console.log(c.cyan("[Types]"), c.green("built"));
   } catch (error) {
      console.error(c.cyan("[Types]"), c.red("build failed"), error);
      process.exitCode = 1;
   }
}