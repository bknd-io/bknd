import {
   isCancel as $isCancel,
   log as $log,
   password as $password,
   text as $text,
} from "@clack/prompts";
import type { App } from "App";
import type { PasswordStrategy } from "auth/authenticate/strategies";
import { makeAppFromEnv } from "cli/commands/run";
import type { CliCommand } from "cli/types";
import { Argument } from "commander";
import { $console } from "core/utils";
import c from "picocolors";
import { isBun } from "core/utils";

export const user: CliCommand = (program) => {
   program
      .command("user")
      .description("create/update users, or generate a token (auth)")
      .addArgument(
         new Argument("<action>", "action to perform").choices(["create", "update", "token"]),
      )
      .option("--config <config>", "config file")
      .option("--db-url <db>", "database url, can be any valid sqlite url")
      .action(action);
};

async function action(action: "create" | "update" | "token", options: any) {
   const app = await makeAppFromEnv({
      config: options.config,
      dbUrl: options.dbUrl,
      server: "node",
   });

   switch (action) {
      case "create":
         await create(app, options);
         break;
      case "update":
         await update(app, options);
         break;
      case "token":
         await token(app, options);
         break;
   }
}

async function create(app: App, options: any) {
   const strategy = app.module.auth.authenticator.strategy("password") as PasswordStrategy;

   if (!strategy) {
      $log.error("Password strategy not configured");
      process.exit(1);
   }

   const email = await $text({
      message: "Enter email",
      validate: (v) => {
         if (!v.includes("@")) {
            return "Invalid email";
         }
         return;
      },
   });
   if ($isCancel(email)) process.exit(1);

   const password = await $password({
      message: "Enter password",
      validate: (v) => {
         if (v.length < 3) {
            return "Invalid password";
         }
         return;
      },
   });
   if ($isCancel(password)) process.exit(1);

   try {
      const created = await app.createUser({
         email,
         password: await strategy.hash(password as string),
      });
      $log.success(`Created user: ${c.cyan(created.email)}`);
   } catch (e) {
      $log.error("Error creating user");
      $console.error(e);
   }
}

async function update(app: App, options: any) {
   const config = app.module.auth.toJSON(true);

   const email = (await $text({
      message: "Which user? Enter email",
      validate: (v) => {
         if (!v.includes("@")) {
            return "Invalid email";
         }
         return;
      },
   })) as string;
   if ($isCancel(email)) process.exit(1);

   const { data: user } = await app.modules
      .ctx()
      .em.repository(config.entity_name as "users")
      .findOne({ email });
   if (!user) {
      $log.error("User not found");
      process.exit(1);
   }
   $log.info(`User found: ${c.cyan(user.email)}`);

   const password = await $password({
      message: "New Password?",
      validate: (v) => {
         if (v.length < 3) {
            return "Invalid password";
         }
         return;
      },
   });
   if ($isCancel(password)) process.exit(1);

   if (await app.module.auth.changePassword(user.id, password)) {
      $log.success(`Updated user: ${c.cyan(user.email)}`);
   } else {
      $log.error("Error updating user");
   }
}

async function token(app: App, options: any) {
   if (isBun()) {
      $log.error("Please use node to generate tokens");
      process.exit(1);
   }

   const config = app.module.auth.toJSON(true);
   const users_entity = config.entity_name as "users";
   const em = app.modules.ctx().em;

   const email = (await $text({
      message: "Which user? Enter email",
      validate: (v) => {
         if (!v.includes("@")) {
            return "Invalid email";
         }
         return;
      },
   })) as string;
   if ($isCancel(email)) process.exit(1);

   const { data: user } = await em.repository(users_entity).findOne({ email });
   if (!user) {
      $log.error("User not found");
      process.exit(1);
   }
   $log.info(`User found: ${c.cyan(user.email)}`);

   // biome-ignore lint/suspicious/noConsoleLog:
   console.log(
      `\n${c.dim("Token:")}\n${c.yellow(await app.module.auth.authenticator.jwt(user))}\n`,
   );
}
