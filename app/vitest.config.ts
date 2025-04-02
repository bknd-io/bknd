import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
   plugins: [react(), tsconfigPaths()],
   test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./__test__/vitest/setup.ts"],
      include: ["**/*.vi-test.ts"],
      coverage: {
         provider: "v8",
         reporter: ["text", "json", "html"],
         exclude: ["node_modules/", "**/*.d.ts", "**/*.test.ts", "**/*.config.ts"],
      },
   },
});
