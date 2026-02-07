import { createMDX } from "fumadocs-mdx/next";
import { redirectsConfig } from "./redirects.config.mjs";
import { rewritesConfig } from "./rewrites.config.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
   output: "export",
   trailingSlash: true,
   reactStrictMode: true,
   serverExternalPackages: ["typescript", "twoslash"],

   async redirects() {
      return redirectsConfig;
   },

   webpack(config) {
      config.resolve.alias["@/bknd"] = path.resolve(__dirname, "../app/src");
      config.resolve.alias["@"] = path.resolve(__dirname);
      return config;
   },
   eslint: {
      ignoreDuringBuilds: true,
   },
};

if (process.env.NODE_ENV === "development") {
   config.output = "standalone";
   config.rewrites = async () => rewritesConfig;
}

export default withMDX(config);
