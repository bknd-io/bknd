import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
   plugins: [react(), tsconfigPaths()],
   test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      coverage: {
         provider: "v8",
         reporter: ["text", "json", "html"],
         exclude: [
            "node_modules/",
            "src/test/setup.ts",
            "**/*.d.ts",
            "**/*.test.ts",
            "**/*.config.ts",
         ],
      },
   },
});
