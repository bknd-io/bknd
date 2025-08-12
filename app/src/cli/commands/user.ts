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
import { $console, isBun } from "bknd/utils";
import c from "picocolors";

export const user: CliCommand = (program) => {
   program
      .command("user")
      .description("create/update users, or generate a token (auth)")
      .addArgument(
         new Argument("<action>", "action to perform").choices(["create", "update", "token"]),
      )
      .action(action);
};

async function action(action: "create" | "update" | "token", options: any) {
   const app = await makeAppFromEnv({
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
   const strategy = app.module.auth.authenticator.strategy("password") as PasswordStrategy;
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

   try {
      function togglePw(visible: boolean) {
         const field = em.entity(users_entity).field("strategy_value")!;

         field.config.hidden = !visible;
         field.config.fillable = visible;
      }
      togglePw(true);
      await app.modules
         .ctx()
         .em.mutator(users_entity)
         .updateOne(user.id, {
            strategy_value: await strategy.hash(password as string),
         });
      togglePw(false);

      $log.success(`Updated user: ${c.cyan(user.email)}`);
   } catch (e) {
      $log.error("Error updating user");
      $console.error(e);
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
