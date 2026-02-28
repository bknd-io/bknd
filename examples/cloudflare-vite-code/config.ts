/// <reference types="./worker-configuration.d.ts" />

import type { CloudflareBkndConfig } from "bknd/adapter/cloudflare";
import { code } from "bknd/modes";
import { boolean, em, entity, text } from "bknd";

const schema = em({
   todos: entity("todos", {
      title: text(),
      done: boolean(),
   }),
});

// register your schema to get automatic type completion
// alternatively, you can use the CLI to generate types
// learn more at https://docs.bknd.io/usage/cli/#generating-types-types
type Database = (typeof schema)["DB"];
declare module "bknd" {
   interface DB extends Database {}
}

export default code<CloudflareBkndConfig>({
   app: (env) => ({
      config: {
         data: schema.toJSON(),
         auth: {
            enabled: true,
            jwt: {
               // unlike hybrid mode, secrets are directly passed to the config
               secret: env.JWT_SECRET,
               issuer: "cloudflare-vite-code-example",
            },
         },
      },
      // we need to disable the admin controller using the vite plugin, since we want to render our own app
      adminOptions: false,
      // this is important to determine whether the database should be automatically synced
      isProduction: env.ENVIRONMENT === "production",

      // note: usually you would use `options.seed` to seed the database, but since we're using code mode,
      // we don't know when the db is empty. So we need to create a separate seed function, see `seed.ts`.
   }),
});
