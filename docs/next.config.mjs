import { createMDX } from "fumadocs-mdx/next";
import { redirectsConfig } from "./redirects.config.mjs";
import { rewritesConfig } from "./rewrites.config.mjs";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  trailingSlash: true,
  reactStrictMode: true,
  async redirects() {
    return redirectsConfig;
  },
  async rewrites() {
    return rewritesConfig;
  },
};

export default withMDX(config);
