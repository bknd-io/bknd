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
   plugins: [
      sqlocal(),
      react(),
      tailwindcss(),
      tsconfigPaths(),
      /* {
         name: "configure-response-headers",
         configureServer: (server) => {
            server.middlewares.use((_req, res, next) => {
               res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
               res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
               next();
            });
         },
      }, */
   ],
});
