import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";
export default defineConfig({
   plugins: [tsconfigPaths()],
   test: {
      projects: ["**/*.vitest.config.ts"],
      include: ["**/*.vi-test.ts", "**/*.vitest.ts"],
   },
});

// export defineConfig({
//    plugins: [tsconfigPaths()],
//    test: {
//       globals: true,
//       environment: "jsdom",
//       setupFiles: ["./__test__/vitest/setup.ts"],
//       include: ["**/*.vi-test.ts", "**/*.vitest.ts"],
//       coverage: {
//          provider: "v8",
//          reporter: ["text", "json", "html"],
//          exclude: ["node_modules/", "**/*.d.ts", "**/*.test.ts", "**/*.config.ts"],
//       },
//    },
// });
