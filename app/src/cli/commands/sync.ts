import type { CliCommand } from "../types";
import { makeAppFromEnv } from "cli/commands/run";
import { writeFile } from "node:fs/promises";
import c from "picocolors";
import { withConfigOptions } from "cli/utils/options";

export const sync: CliCommand = (program) => {
   withConfigOptions(program.command("sync"))
      .description("sync database")
      .option("--force", "perform database syncing operations")
      .option("--seed", "perform seeding operations")
      .option("--drop", "include destructive DDL operations")
      .option("--out <file>", "output file")
      .option("--sql", "use sql output")
      .action(async (options) => {
         const app = await makeAppFromEnv(options);
         const schema = app.em.schema();
         console.info(c.dim("Checking database state..."));
         const stmts = await schema.sync({ drop: options.drop });

         console.info("");
         if (stmts.length === 0) {
            console.info(c.yellow("No changes to sync"));
         } else {
            // @todo: currently assuming parameters aren't used
            const sql = stmts.map((d) => d.sql).join(";\n") + ";";

            if (options.force) {
               console.info(c.dim("Executing:") + "\n" + c.cyan(sql));
               await schema.sync({ force: true, drop: options.drop });

               console.info(`\n${c.dim(`Executed ${c.cyan(stmts.length)} statement(s)`)}`);
               console.info(`${c.green("Database synced")}`);
            } else {
               if (options.out) {
                  const output = options.sql ? sql : JSON.stringify(stmts, null, 2);
                  await writeFile(options.out, output);
                  console.info(`SQL written to ${c.cyan(options.out)}`);
               } else {
                  console.info(c.dim("DDL to execute:") + "\n" + c.cyan(sql));

                  console.info(
                     c.yellow(
                        "\nNo statements have been executed. Use --force to perform database syncing operations",
                     ),
                  );
               }
            }
         }

         if (options.seed) {
            console.info(c.dim("\nExecuting seed..."));
            const seed = app.options?.seed;
            if (seed) {
               await seed({
                  ...app.modules.ctx(),
                  app: app,
               });
               console.info(c.green("Seed executed"));
            } else {
               console.info(c.yellow("No seed function provided"));
            }
         }

         process.exit(0);
      });
};
