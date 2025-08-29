import type { CliCommand } from "../types";
import { makeAppFromEnv } from "cli/commands/run";
import { writeFile } from "node:fs/promises";
import c from "picocolors";
import { withConfigOptions } from "cli/utils/options";

export const sync: CliCommand = (program) => {
   withConfigOptions(program.command("sync"))
      .description("sync database")
      .option("--dump", "dump operations to console instead of executing them")
      .option("--drop", "include destructive DDL operations")
      .option("--out <file>", "output file")
      .option("--sql", "use sql output")
      .action(async (options) => {
         const app = await makeAppFromEnv(options);
         const schema = app.em.schema();
         const stmts = await schema.sync({ drop: options.drop });

         console.info("");
         if (stmts.length === 0) {
            console.info(c.yellow("No changes to sync"));
            process.exit(0);
         }
         // @todo: currently assuming parameters aren't used
         const sql = stmts.map((d) => d.sql).join(";\n") + ";";

         if (options.dump) {
            if (options.out) {
               const output = options.sql ? sql : JSON.stringify(stmts, null, 2);
               await writeFile(options.out, output);
               console.info(`SQL written to ${c.cyan(options.out)}`);
            } else {
               console.info(options.sql ? c.cyan(sql) : stmts);
            }

            process.exit(0);
         }

         await schema.sync({ force: true, drop: options.drop });
         console.info(c.cyan(sql));

         console.info(`${c.gray(`Executed ${c.cyan(stmts.length)} statement(s)`)}`);
         console.info(`${c.green("Database synced")}`);
      });
};
