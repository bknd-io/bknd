/// <reference types="@types/bun" />

import type { Tool, Resource } from "jsonv-ts/mcp";
import { rimraf } from "rimraf";
import { writeFile, readFile } from "node:fs/promises";

const config = {
   mcpConfig: "./mcp.json",
   outFile: "./content/docs/(documentation)/modules/server/mcp.mdx",
};

async function generate() {
   console.info("Generating MCP documentation...");

   try {
      console.log("bun version", Bun.version);
   } catch (e) {
      console.log("bun failed");
   }

   await cleanup();
   const mcpConfig = JSON.parse(await readFile(config.mcpConfig, "utf-8"));
   const document = await generateDocument(mcpConfig);
   await writeFile(config.outFile, document, "utf-8");
   console.info("MCP documentation generated.");
}

async function generateDocument({
   tools,
   resources,
}: {
   tools: ReturnType<Tool["toJSON"]>[];
   resources: ReturnType<Resource["toJSON"]>[];
}) {
   return `---
title: "MCP"
description: "Built-in full featured MCP server."
tags: ["documentation"]
---
import { JsonSchemaTypeTable } from '@/components/McpTool';

## Tools

${tools
   .map(
      (t) => `
### \`${t.name}\`

${t.description ?? ""}

<JsonSchemaTypeTable schema={${JSON.stringify(t.inputSchema)}} key={"${String(t.name)}"} />`,
   )
   .join("\n")}
   

## Resources

${resources
   .map(
      (r) => `

### \`${r.name}\`

${r.description ?? ""}
`,
   )
   .join("\n")}
`;
}

async function cleanup() {
   await rimraf(config.outFile);
}

void generate();
