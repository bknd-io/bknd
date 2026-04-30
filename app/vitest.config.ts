import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
      tsconfigPaths: true,
   },
   test: {
      include: ["**/*.vi-test.ts", "**/*.vitest.ts"],
   },
});
