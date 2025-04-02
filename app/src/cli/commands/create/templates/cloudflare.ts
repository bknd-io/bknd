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

      const db = await $p.select({
         message: "What database do you want to use?",
         options: [
            { label: "Cloudflare D1", value: "d1" },
            { label: "LibSQL", value: "libsql" },
         ],
      });
      if ($p.isCancel(db)) {
         process.exit(1);
      }

      try {
         switch (db) {
            case "d1":
               await createD1(ctx);
               break;
            case "libsql":
               await createLibsql(ctx);
               break;
            default:
               throw new Error("Invalid database");
         }
      } catch (e) {
         const message = (e as any).message || "An error occurred";
         $p.log.warn(
            "Couldn't add database. You can add it manually later. Error: " + c.red(message),
         );
      }

      await createR2(ctx);
   },
} as const satisfies Template;

async function createD1(ctx: TemplateSetupCtx) {
   const name = await $p.text({
      message: "Enter database name",
      initialValue: "data",
      placeholder: "data",
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

   exec(`npx wrangler d1 create ${name}`);
   await $p.stream.info(
      (async function* () {
         yield* typewriter("Please update your wrangler configuration with the output above.");
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
               database_id: uuid(),
            },
         ],
      }),
      { dir: ctx.dir },
   );
}

async function createLibsql(ctx: TemplateSetupCtx) {
   await overrideJson(
      WRANGLER_FILE,
      (json) => ({
         ...json,
         vars: {
            DB_URL: "http://127.0.0.1:8080",
         },
      }),
      { dir: ctx.dir },
   );

   await overridePackageJson(
      (pkg) => ({
         ...pkg,
         scripts: {
            ...pkg.scripts,
            db: "turso dev",
            dev: "npm run db && wrangler dev",
         },
      }),
      { dir: ctx.dir },
   );

   await $p.stream.info(
      (async function* () {
         yield* typewriter("Database set to LibSQL");
         await wait();
         yield* typewriter(
            `\nYou can now run ${c.cyan("npm run db")} to start the database and ${c.cyan("npm run dev")} to start the worker.`,
            c.dim,
         );
         await wait();
         yield* typewriter(
            `\nAlso make sure you have Turso's CLI installed. Check their docs on how to install at ${c.cyan("https://docs.turso.tech/cli/introduction")}`,
            c.dim,
         );
      })(),
   );
}

async function createR2(ctx: TemplateSetupCtx) {
   const create = await $p.confirm({
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

   const name = await $p.text({
      message: "Enter bucket name",
      initialValue: "bucket",
      placeholder: "bucket",
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

   exec(`npx wrangler r2 bucket create ${name}`);

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
}
