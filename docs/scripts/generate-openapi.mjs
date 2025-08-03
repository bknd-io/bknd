import { generateFiles } from "fumadocs-openapi";
import { rimraf } from "rimraf";
import fs from "node:fs";

const outDir = "./content/docs/api-reference";
const schemaPath = "./openapi.json";

async function generate() {
   try {
      if (!fs.existsSync(schemaPath)) {
         console.error(
            `[generate-openapi] Missing ${schemaPath}. Make sure openapi.json is located in the docs project root.`,
         );
         process.exit(1);
      }

      console.log("Cleaning generated files...");
      await rimraf(outDir, {
         filter: (v) => !v.endsWith("introduction.mdx") && !v.endsWith("meta.json"),
      });
      console.log("Clean complete.");

      console.log("Generating OpenAPI documentation...");
      await generateFiles({
         input: [schemaPath],
         output: outDir,
         per: "operation",
         groupBy: "tag",
         includeDescription: true,
         addGeneratedComment: true,
      });
      console.log("OpenAPI docs generated.");
   } catch (error) {
      console.error("Error while generating OpenAPI docs:");
      console.error(error);
      process.exit(1);
   }
}

void generate();
