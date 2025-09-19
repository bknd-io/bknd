import pkg from "./package.json" with { type: "json" };
import c from "picocolors";
import { formatNumber } from "bknd/utils";
import * as esbuild from "esbuild";

const deps = Object.keys(pkg.dependencies);
const external = ["jsonv-ts/*", "wrangler", ...deps];

if (process.env.DEBUG) {
   const result = await esbuild.build({
      entryPoints: ["./src/cli/index.ts"],
      outdir: "./dist/cli",
      platform: "node",
      minify: true,
      format: "esm",
      metafile: true,
      bundle: true,
      external,
      define: {
         __isDev: "0",
         __version: JSON.stringify(pkg.version),
      },
   });
   await Bun.write("./dist/cli/metafile-esm.json", JSON.stringify(result.metafile, null, 2));
   process.exit(0);
}

const result = await Bun.build({
   entrypoints: ["./src/cli/index.ts"],
   target: "node",
   outdir: "./dist/cli",
   env: "PUBLIC_*",
   minify: true,
   external,
   define: {
      __isDev: "0",
      __version: JSON.stringify(pkg.version),
   },
});

for (const output of result.outputs) {
   const size_ = await output.text();
   console.info(
      c.cyan(formatNumber.fileSize(size_.length)),
      c.dim(output.path.replace(import.meta.dir + "/", "")),
   );
}
