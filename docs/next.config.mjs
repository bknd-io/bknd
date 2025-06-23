import { createMDX } from "fumadocs-mdx/next";
import { redirectsConfig } from "./redirects.config.mjs";
import { rewritesConfig } from "./rewrites.config.mjs";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  trailingSlash: true,
  reactStrictMode: true,
};

if (process.env.NODE_ENV === "development") {
  config.redirects = async () => redirectsConfig;
  config.rewrites = async () => rewritesConfig;
}

export default withMDX(config);
