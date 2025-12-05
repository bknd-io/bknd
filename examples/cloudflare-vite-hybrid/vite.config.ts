import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devFsVitePlugin } from "bknd/adapter/cloudflare";

export default defineConfig({
   plugins: [
      react(),
      // this plugin provides filesystem access during development
      devFsVitePlugin({ configFile: "config.ts" }) as any,
      tailwindcss(),
      cloudflare(),
   ],
   build: {
      minify: true,
   },
   resolve: {
      dedupe: ["react", "react-dom"],
   },
});
