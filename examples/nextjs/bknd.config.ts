import type { NextjsBkndConfig } from "bknd/adapter/nextjs";
import { boolean, em, entity, text } from "bknd";
import { registerLocalMediaAdapter } from "bknd/adapter/node";
import { secureRandomString } from "bknd/utils";

// The local media adapter works well in development, and server based
// deployments. However, on vercel or any other serverless deployments,
// you shouldn't use a filesystem based media adapter.
//
// Additionally, if you run the bknd api on the "edge" runtime,
// this would not work as well.
//
// For production, it is recommended to uncomment the line below.
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
   app: (env) => ({
      connection: {
         url: env.DB_URL ?? "file:data.db",
      },
   }),
   // an initial config is only applied if the database is empty
   initialConfig: {
      data: schema.toJSON(),
      // we're enabling auth ...
      auth: {
         enabled: true,
         jwt: {
            issuer: "bknd-nextjs-example",
            secret: secureRandomString(64),
         },
         cookie: {
            pathSuccess: "/ssr",
            pathLoggedOut: "/ssr",
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
} as const satisfies NextjsBkndConfig;
