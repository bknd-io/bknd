import { createMDX } from "fumadocs-mdx/next";
import { redirectsConfig } from "./redirects.config.mjs";
import { rewritesConfig } from "./rewrites.config.mjs";
import path from "path";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  trailingSlash: true,
  reactStrictMode: true,
  serverExternalPackages: ["typescript", "twoslash"],

  webpack(config) {
    config.resolve.alias["@/bknd"] = path.resolve(__dirname, "../app/src");
    config.resolve.alias["@"] = path.resolve(__dirname);
    return config;
  },
};

if (process.env.NODE_ENV === "development") {
  config.output = "standalone";
  config.redirects = async () => redirectsConfig;
  config.rewrites = async () => rewritesConfig;
}

export default withMDX(config);
