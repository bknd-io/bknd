import { boolean, em, entity, text } from "bknd";
import { Route } from "wouter";
import IndexPage from "~/routes/_index";
import { BkndBrowserApp, type BrowserBkndConfig } from "bknd/adapter/browser";

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

const config = {
   config: {
      data: schema.toJSON(),
      auth: {
         enabled: true,
         jwt: {
            secret: "secret",
         },
      },
   },
   adminConfig: {
      basepath: "/admin",
      logo_return_path: "/../",
   },
   options: {
      // the seed option is only executed if the database was empty
      seed: async (ctx) => {
         await ctx.em.mutator("todos").insertMany([
            { title: "Learn bknd", done: true },
            { title: "Build something cool", done: false },
         ]);

         // @todo: auth is currently not working due to POST request
         await ctx.app.module.auth.createUser({
            email: "test@bknd.io",
            password: "12345678",
         });
      },
   },
} satisfies BrowserBkndConfig;

export default function App() {
   return (
      <BkndBrowserApp {...config}>
         <Route path="/" component={IndexPage} />
      </BkndBrowserApp>
   );
}
