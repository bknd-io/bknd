import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import sqlocal from "sqlocal/vite";

// https://vite.dev/config/
// https://sqlocal.dallashoffman.com/guide/setup#vite-configuration
export default defineConfig({
   optimizeDeps: {
      exclude: ["sqlocal"],
   },
   resolve: {
      dedupe: ["react", "react-dom"],
   },
   plugins: [sqlocal(), react(), tailwindcss(), tsconfigPaths()],
});
