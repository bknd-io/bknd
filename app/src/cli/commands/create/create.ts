import fs from "node:fs";
import { downloadTemplate } from "@bluwy/giget-core";
import * as $p from "@clack/prompts";
import type { CliCommand } from "cli/types";
import { typewriter, wait } from "cli/utils/cli";
import { execAsync, getVersion } from "cli/utils/sys";
import { Option } from "commander";
import { env } from "bknd";
import color from "picocolors";
import { overridePackageJson, updateBkndPackages } from "./npm";
import { type Template, templates, type TemplateSetupCtx } from "./templates";
import { createScoped, flush } from "cli/utils/telemetry";

const config = {
   types: {
      runtime: "Runtime",
      framework: "Framework",
   },
   runtime: {
      node: "Node.js",
      bun: "Bun",
      cloudflare: "Cloudflare",
      aws: "AWS Lambda",
   },
   framework: {
      nextjs: "Next.js",
      "react-router": "React Router",
      astro: "Astro",
   },
} as const;

export const create: CliCommand = (program) => {
   program
      .command("create")
      .addOption(new Option("-i, --integration <integration>", "integration to use"))
      .addOption(new Option("-t, --template <template>", "template to use"))
      .addOption(new Option("-d --dir <directory>", "directory to create in"))
      .addOption(new Option("-c, --clean", "cleans destination directory"))
      .addOption(new Option("-y, --yes", "use defaults, skip skippable prompts"))
      .description("create a new project")
      .action(action);
};

function errorOutro() {
   $p.outro(color.red("Failed to create project."));
   // biome-ignore lint/suspicious/noConsoleLog:
   console.log(
      color.yellow("Sorry that this happened. If you think this is a bug, please report it at: ") +
         color.cyan("https://github.com/bknd-io/bknd/issues"),
   );
   // biome-ignore lint/suspicious/noConsoleLog:
   console.log("");
   process.exit(1);
}

async function onExit() {
   await flush();
}

async function action(options: {
   template?: string;
   dir?: string;
   integration?: string;
   yes?: boolean;
   clean?: boolean;
}) {
   // biome-ignore lint/suspicious/noConsoleLog:
   console.log("");
   const $t = createScoped("create");
   $t.capture("start", {
      options,
   });

   const downloadOpts = {
      dir: options.dir || "./",
      clean: false,
   };

   const version = await getVersion();
   $p.intro(
      `👋 Welcome to the ${color.bold(color.cyan("bknd"))} create cli ${color.bold(`v${version}`)}`,
   );

   await $p.stream.message(
      (async function* () {
         yield* typewriter("Thanks for choosing to create a new project with bknd!", color.dim);
         await wait();
      })(),
   );

   $t.properties.at = "dir";
   if (!options.dir) {
      const dir = await $p.text({
         message: "Where to create your project?",
         placeholder: downloadOpts.dir,
         initialValue: downloadOpts.dir,
      });
      if ($p.isCancel(dir)) {
         await onExit();
         process.exit(1);
      }

      downloadOpts.dir = dir || "./";
   }

   $t.properties.at = "dir";
   if (fs.existsSync(downloadOpts.dir)) {
      const clean =
         options.clean ??
         (await $p.confirm({
            message: `Directory ${color.cyan(downloadOpts.dir)} exists. Clean it?`,
            initialValue: false,
         }));
      if ($p.isCancel(clean)) {
         await onExit();
         process.exit(1);
      }

      downloadOpts.clean = clean;
      $t.properties.clean = clean;
   }

   // don't track name for privacy
   let name = downloadOpts.dir.includes("/")
      ? downloadOpts.dir.split("/").pop()
      : downloadOpts.dir.replace(/[./]/g, "");

   if (!name || name.length === 0) name = "bknd";

   let template: Template | undefined;

   if (options.template) {
      $t.properties.at = "template";
      template = templates.find((t) => t.key === options.template) as Template;
      if (!template) {
         await onExit();
         $p.log.error(`Template ${color.cyan(options.template)} not found`);
         process.exit(1);
      }
   } else {
      $t.properties.at = "integration";
      let integration: string | undefined = options.integration;
      if (!integration) {
         await $p.stream.info(
            (async function* () {
               yield* typewriter("Ready? ", color.bold, 1.5);
               await wait(2);
               yield* typewriter("Let's find the perfect template for you.", color.dim);
               await wait(2);
            })(),
         );

         const type = await $p.select({
            message: "Pick an integration type",
            options: Object.entries(config.types).map(([value, name]) => ({
               value,
               label: name,
               hint: Object.values(config[value]).join(", "),
            })),
         });

         if ($p.isCancel(type)) {
            await onExit();
            process.exit(1);
         }
         $t.properties.type = type;

         const _integration = await $p.select({
            message: `Which ${color.cyan(config.types[type])} do you want to continue with?`,
            options: Object.entries(config[type]).map(([value, name]) => ({
               value,
               label: name,
            })) as any,
         });
         if ($p.isCancel(_integration)) {
            await onExit();
            process.exit(1);
         }
         integration = String(_integration);
         $t.properties.integration = integration;
      }
      if (!integration) {
         await onExit();
         $p.log.error("No integration selected");
         process.exit(1);
      }

      const choices = templates.filter((t) => t.integration === integration);
      if (choices.length === 0) {
         await onExit();
         $p.log.error(`No templates found for "${color.cyan(String(integration))}"`);
         process.exit(1);
      } else if (choices.length > 1) {
         $t.properties.at = "template";
         const selected_template = await $p.select({
            message: "Pick a template",
            options: choices.map((t) => ({ value: t.key, label: t.title, hint: t.description })),
         });

         if ($p.isCancel(selected_template)) {
            await onExit();
            process.exit(1);
         }

         template = choices.find((t) => t.key === selected_template) as Template;
      } else {
         template = choices[0];
      }
   }
   if (!template) {
      await onExit();
      $p.log.error("No template selected");
      process.exit(1);
   }

   $t.properties.template = template.key;
   const ctx: TemplateSetupCtx = { template, dir: downloadOpts.dir, name, skip: !!options.yes };

   {
      const ref = env("cli_create_ref", `#v${version}`, {
         onValid: (given) => {
            $p.log.warn(color.dim("[DEV] Using local ref: ") + color.yellow(given));
         },
      });
      $t.properties.ref = ref;
      $t.capture("used");

      const prefix =
         template.ref === true
            ? `#${ref}`
            : typeof template.ref === "string"
              ? `#${template.ref}`
              : "";
      const url = `${template.path}${prefix}`;

      const s = $p.spinner();
      await s.start("Downloading template...");
      try {
         await downloadTemplate(url, {
            dir: ctx.dir,
            force: downloadOpts.clean ? "clean" : true,
         });
      } catch (e) {
         if (e instanceof Error) {
            s.stop("Failed to download template: " + color.red(e.message), 1);
         } else {
            console.error(e);
            s.stop("Failed to download template. Check logs above.", 1);
         }

         errorOutro();
      }

      s.stop("Template downloaded.");
      await updateBkndPackages(ctx.dir);

      if (template.preinstall) {
         await template.preinstall(ctx);
      }
   }

   // update package name
   await overridePackageJson(
      (pkg) => ({
         ...pkg,
         name: ctx.name,
      }),
      { dir: ctx.dir },
   );
   $p.log.success(`Updated package name to ${color.cyan(ctx.name)}`);

   {
      const install =
         options.yes ??
         (await $p.confirm({
            message: "Install dependencies?",
         }));

      if ($p.isCancel(install)) {
         await onExit();
         process.exit(1);
      } else if (install) {
         $t.properties.install = true;
         const install_cmd = template.scripts?.install || "npm install";

         const s = $p.spinner();
         await s.start("Installing dependencies...");
         try {
            await execAsync(`cd ${ctx.dir} && ${install_cmd}`, { silent: true });
         } catch (e) {
            if (e instanceof Error) {
               s.stop("Failed to install: " + color.red(e.message), 1);
            } else {
               console.error(e);
               s.stop("Failed to install. Check logs above.", 1);
            }

            errorOutro();
         }

         s.stop("Dependencies installed.");

         if (template!.postinstall) {
            await template.postinstall(ctx);
         }
      } else {
         $t.properties.install = false;
         await $p.stream.warn(
            (async function* () {
               yield* typewriter(
                  color.dim("Remember to run ") +
                     color.cyan("npm install") +
                     color.dim(" after setup"),
               );
               await wait();
            })(),
         );
      }
   }

   if (template.setup) {
      await template.setup(ctx);
   }

   await $p.stream.success(
      (async function* () {
         yield* typewriter("That's it! ");
         await wait(0.5);
         yield "🎉";
         await wait();
         yield "\n\n";
         yield* typewriter(
            `Enter your project's directory using ${color.cyan("cd " + ctx.dir)}
If you need help, check ${color.cyan("https://docs.bknd.io")} or join our Discord!`,
         );
         await wait(2);
      })(),
   );

   $t.capture("complete");
   $p.outro(color.green("Setup complete."));
}
