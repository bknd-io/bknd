import { defineConfig, type UserConfig } from "vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from '@tailwindcss/vite'


export default defineConfig((): UserConfig => {
  return {
    plugins: [
      tailwindcss(),
      qwikCity({
        trailingSlash: false
      }),
      qwikVite(),
      tsconfigPaths({ root: "." }),
    ],
    server: {
      headers: {
        "Cache-Control": "public, max-age=0",
      },
    },
    preview: {
      headers: {
        "Cache-Control": "public, max-age=600",
      },
    },
  };
});