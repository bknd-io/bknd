import * as $p from "@clack/prompts";
import { upsertEnvFile } from "cli/commands/create/npm";
import { typewriter } from "cli/utils/cli";
import c from "picocolors";
import type { Template } from ".";
import open from "open";

export const aws = {
   key: "aws",
   title: "AWS Lambda Basic",
   integration: "aws",
   description: "A basic bknd AWS Lambda starter",
   path: "gh:bknd-io/bknd/examples/aws-lambda",
   ref: true,
   setup: async (ctx) => {
      await $p.stream.info(
         (async function* () {
            yield* typewriter("You need a running LibSQL instance for this adapter to work.");
         })(),
      );

      const choice = await $p.select({
         message: "How do you want to proceed?",
         options: [
            { label: "Enter instance details", value: "enter" },
            { label: "Create a new instance", value: "new" },
         ],
      });
      if ($p.isCancel(choice)) {
         process.exit(1);
      }

      if (choice === "new") {
         await $p.stream.info(
            (async function* () {
               yield* typewriter(c.dim("Proceed on turso.tech to create your instance."));
            })(),
         );

         await open("https://sqlite.new");
      }

      const url = await $p.text({
         message: "Enter database URL",
         placeholder: "libsql://<instance>.turso.io",
         validate: (v) => {
            if (!v) {
               return "Invalid URL";
            }
            return;
         },
      });
      if ($p.isCancel(url)) {
         process.exit(1);
      }

      const token = await $p.text({
         message: "Enter database token",
         placeholder: "eyJhbGciOiJIUzI1NiIsInR...",
         validate: (v) => {
            if (!v) {
               return "";
            }
            return;
         },
      });
      if ($p.isCancel(token)) {
         process.exit(1);
      }

      await upsertEnvFile(
         {
            DB_URL: url,
            DB_TOKEN: token ?? "",
         },
         { dir: ctx.dir },
      );

      await $p.stream.info(
         (async function* () {
            yield* typewriter(`Connection details written to ${c.cyan(".env")}`);
         })(),
      );
   },
} as const satisfies Template;
