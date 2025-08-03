import { registerLocalMediaAdapter } from "bknd/adapter/node";
import type { BkndConfig } from "bknd/adapter";
import { boolean, em, entity, text } from "bknd";
import { secureRandomString } from "bknd/utils";

// since we're running in node, we can register the local media adapter
const local = registerLocalMediaAdapter();

const schema = em({
   todos: entity("todos", {
      title: text(),
      done: boolean(),
   }),
});

// register your schema to get automatic type completion
type Database = (typeof schema)["DB"];
declare module "bknd" {
   interface DB extends Database {}
}

export default {
   // we can use any libsql config, and if omitted, uses in-memory
   connection: {
      url: process.env.DB_URL ?? "file:data.db",
   },
   // an initial config is only applied if the database is empty
   initialConfig: {
      data: schema.toJSON(),
      // we're enabling auth ...
      auth: {
         enabled: true,
         jwt: {
            issuer: "bknd-waku-example",
            secret: secureRandomString(64),
         },
      },
      // ... and media
      media: {
         enabled: true,
         adapter: local({
            path: "./public/uploads",
         }),
      },
   },
   options: {
      // the seed option is only executed if the database was empty
      seed: async (ctx) => {
         // create some entries
         await ctx.em.mutator("todos").insertMany([
            { title: "Learn bknd", done: true },
            { title: "Build something cool", done: false },
         ]);

         // and create a user
         await ctx.app.module.auth.createUser({
            email: "test@bknd.io",
            password: "12345678",
         });
      },
   },
} as const satisfies BkndConfig<{ DB_URL?: string }>;
