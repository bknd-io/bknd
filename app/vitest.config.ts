import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
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
