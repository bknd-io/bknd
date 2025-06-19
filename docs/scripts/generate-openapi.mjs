import { generateFiles } from "fumadocs-openapi";
import { rimraf } from "rimraf";

const outDir = "./content/docs/api-reference";

async function generate() {
  console.log("Cleaning generated files...");
  await rimraf(outDir, {
    filter(v) {
      return !v.endsWith("introduction.mdx") && !v.endsWith("meta.json");
    },
  });
  console.log("Generated files cleaned");

  await generateFiles({
    input: ["./openapi.json"],
    output: outDir,
    per: "operation",
    groupBy: "tag",
    includeDescription: true,
    addGeneratedComment: true,
  });
  console.log("OpenAPI docs generated");
}

void generate();
