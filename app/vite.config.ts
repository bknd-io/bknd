import devServer from "@hono/vite-dev-server";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { devServerConfig } from "./src/adapter/vite/dev-server-config";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json" with { type: "json" };

// https://vitejs.dev/config/
export default defineConfig({
   define: {
      __isDev: process.env.NODE_ENV === "production" ? "0" : "1",
      __version: JSON.stringify(pkg.version),
   },
   clearScreen: false,
   publicDir: "./src/ui/assets",
   server: {
      host: true,
      port: 28623,
      hmr: {
         overlay: true,
      },
   },
   plugins: [
      react(),
      tsconfigPaths({
         // otherwise it'll throw an error because of examples/astro
         ignoreConfigErrors: true,
      }),
      devServer({
         ...devServerConfig,
         entry: "./vite.dev.ts",
      }),
      tailwindcss(),
   ],
   build: {
      manifest: true,
      outDir: "./dist/static",
      rollupOptions: {
         input: "./src/ui/main.tsx",
      },
   },
});
