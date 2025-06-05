import { createMDX } from "fumadocs-mdx/next";
import { redirectsConfig } from "./redirects.config.mjs";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async redirects() {
    return redirectsConfig;
  }
};

export default withMDX(config);
