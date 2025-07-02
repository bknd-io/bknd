import * as $p from "@clack/prompts";
import { overrideJson, overridePackageJson } from "cli/commands/create/npm";
import { typewriter, wait } from "cli/utils/cli";
import { uuid } from "core/utils";
import c from "picocolors";
import type { Template, TemplateSetupCtx } from ".";
import { exec } from "cli/utils/sys";

const WRANGLER_FILE = "wrangler.json";

export const cloudflare = {
   key: "cloudflare",
   title: "Cloudflare Basic",
   integration: "cloudflare",
   description: "A basic bknd Cloudflare worker",
   path: "gh:bknd-io/bknd/examples/cloudflare-worker",
   ref: true,
   setup: async (ctx) => {
      // overwrite assets directory & name
      await overrideJson(
         WRANGLER_FILE,
         (json) => ({
            ...json,
            name: ctx.name,
            assets: {
               directory: "node_modules/bknd/dist/static",
            },
         }),
         { dir: ctx.dir },
      );

      try {
         await createD1(ctx);
      } catch (e) {
         const message = (e as any).message || "An error occurred";
         $p.log.warn(
            "Couldn't add database. You can add it manually later. Error: " + c.red(message),
         );
      }

      try {
         await createR2(ctx);
      } catch (e) {
         const message = (e as any).message || "An error occurred";
         $p.log.warn(
            "Couldn't add R2 bucket. You can add it manually later. Error: " + c.red(message),
         );
      }
   },
} as const satisfies Template;

async function createD1(ctx: TemplateSetupCtx) {
   const default_db = "data";
   const name = ctx.skip
      ? default_db
      : await $p.text({
           message: "Enter database name",
           initialValue: default_db,
           placeholder: default_db,
           validate: (v) => {
              if (!v) {
                 return "Invalid name";
              }
              return;
           },
        });
   if ($p.isCancel(name)) {
      process.exit(1);
   }

   await $p.stream.info(
      (async function* () {
         yield* typewriter("Now running wrangler to create a D1 database...");
      })(),
   );

   await overrideJson(
      WRANGLER_FILE,
      (json) => ({
         ...json,
         d1_databases: [
            {
               binding: "DB",
               database_name: name,
               database_id: "00000000-0000-0000-0000-000000000000",
            },
         ],
      }),
      { dir: ctx.dir },
   );

   if (!ctx.skip) {
      exec(`npx wrangler d1 create ${name}`);

      await $p.stream.info(
         (async function* () {
            yield* typewriter("Please update your wrangler configuration with the output above.");
         })(),
      );
   }
}

async function createR2(ctx: TemplateSetupCtx) {
   const create = ctx.skip
      ? false
      : await $p.confirm({
           message: "Do you want to use a R2 bucket?",
           initialValue: true,
        });
   if ($p.isCancel(create)) {
      process.exit(1);
   }

   if (!create) {
      await overrideJson(
         WRANGLER_FILE,
         (json) => ({
            ...json,
            r2_buckets: undefined,
         }),
         { dir: ctx.dir },
      );
      return;
   }

   const default_bucket = "bucket";
   const name = ctx.skip
      ? default_bucket
      : await $p.text({
           message: "Enter bucket name",
           initialValue: default_bucket,
           placeholder: default_bucket,
           validate: (v) => {
              if (!v) {
                 return "Invalid name";
              }
              return;
           },
        });
   if ($p.isCancel(name)) {
      process.exit(1);
   }

   await $p.stream.info(
      (async function* () {
         yield* typewriter("Now running wrangler to create a R2 bucket...");
      })(),
   );

   await overrideJson(
      WRANGLER_FILE,
      (json) => ({
         ...json,
         r2_buckets: [
            {
               binding: "BUCKET",
               bucket_name: name,
            },
         ],
      }),
      { dir: ctx.dir },
   );

   if (!ctx.skip) {
      exec(`npx wrangler r2 bucket create ${name}`);
   }
}
