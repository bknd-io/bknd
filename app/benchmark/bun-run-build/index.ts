/// <reference types="@types/bun" />

import { bench, group } from "mitata";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { runBenchmark, type BenchmarkModule } from "../runner";

const appRoot = join(import.meta.dir, "..", "..");
const distPath = join(appRoot, "dist");

async function cleanDist() {
   await rm(distPath, { recursive: true, force: true });
}

async function runBuild() {
   await cleanDist();

   const proc = Bun.spawn(["bun", "run", "build"], {
      cwd: appRoot,
      env: {
         ...process.env,
         NODE_ENV: "production",
      },
      stdout: "pipe",
      stderr: "pipe",
   });

   const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
   ]);

   if (exitCode !== 0) {
      throw new Error(`bun run build failed with exit code ${exitCode}\n${stdout}\n${stderr}`.trim());
   }
   return exitCode;
}

export const bunRunBuildBenchmark: BenchmarkModule = {
   id: "bun-run-build",
   register() {
      group("bun run build", () => {
         bench("bun run build", async () => {
            return await runBuild();
         });
      });
   },
};

await runBenchmark(bunRunBuildBenchmark);