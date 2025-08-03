import { serve } from "bknd/adapter/vite";
import { App, boolean, em, entity, text } from "bknd";
import { secureRandomString } from "bknd/utils";

export default serve({
   initialConfig: {
      data: em({
         todos: entity("todos", {
            title: text(),
            done: boolean(),
         }),
      }).toJSON(),
      auth: {
         enabled: true,
         jwt: {
            secret: secureRandomString(64),
         },
      },
   },
   options: {
      seed: async (ctx) => {
         await ctx.em.mutator("todos" as any).insertMany([
            { title: "Learn bknd", done: true },
            { title: "Build something cool", done: false },
         ]);
      },
   },
   // here we can hook into the app lifecycle events ...
   beforeBuild: async (app) => {
      app.emgr.onEvent(
         App.Events.AppFirstBoot,
         async () => {
            // ... to create an initial user
            await app.module.auth.createUser({
               email: "ds@bknd.io",
               password: "12345678",
            });
         },
         "sync",
      );
   },
});
