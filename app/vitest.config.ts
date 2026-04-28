import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
   resolve: {
      alias: {
         "bknd/adapter/sqlite": fileURLToPath(new URL("./src/adapter/sqlite/node.ts", import.meta.url)),
      },
   },
   plugins: [
      tsconfigPaths({
         root: ".",
         ignoreConfigErrors: true,
      }) as any,
   ],
   test: {
      include: ["**/*.vi-test.ts", "**/*.vitest.ts"],
   },
});
