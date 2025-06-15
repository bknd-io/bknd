import { defineCollection, defineConfig } from "@content-collections/core";
import {
  createMetaSchema,
  createDocSchema,
  transformMDX
} from "@fumadocs/content-collections/configuration";

const docs = defineCollection({
  name: "docs",
  directory: "content/docs",
  include: "**/*.mdx",
  schema: createDocSchema,
  transform: transformMDX
});

const guide = defineCollection({
  name: "guide",
  directory: "content/guide",
  include: "**/*.mdx",
  schema: createDocSchema,
  transform: transformMDX
});

const metas = defineCollection({
  name: "meta",
  directory: "content",
  include: "**/meta.json",
  parser: "json",
  schema: createMetaSchema
});

export default defineConfig({
  collections: [docs, guide, metas]
});
