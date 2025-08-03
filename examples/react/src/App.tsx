import { lazy, Suspense, useEffect, useState } from "react";
import { checksum } from "bknd/utils";
import { App, boolean, em, entity, text } from "bknd";
import { SQLocalConnection } from "@bknd/sqlocal";
import { Route, Router, Switch } from "wouter";
import IndexPage from "~/routes/_index";
import { Center } from "~/components/Center";
import { ClientProvider } from "bknd/client";

const Admin = lazy(() => import("~/routes/admin"));

export default function () {
   const [app, setApp] = useState<App | undefined>(undefined);
   const [hash, setHash] = useState<string>("");

   async function onBuilt(app: App) {
      document.startViewTransition(async () => {
         setApp(app);
         setHash(await checksum(app.toJSON()));
      });
   }

   useEffect(() => {
      setup({ onBuilt })
         .then((app) => console.log("setup", app?.version()))
         .catch(console.error);
   }, []);

   if (!app)
      return (
         <Center>
            <span className="opacity-20">Loading...</span>
         </Center>
      );

   return (
      <Router key={hash}>
         <Switch>
            <Route
               path="/"
               component={() => (
                  <ClientProvider api={app.getApi()}>
                     <IndexPage app={app} />
                  </ClientProvider>
               )}
            />

            <Route path="/admin/*?">
               <Suspense>
                  <Admin config={{ basepath: "/admin", logo_return_path: "/../" }} app={app} />
               </Suspense>
            </Route>
            <Route path="*">
               <Center className="font-mono text-4xl">404</Center>
            </Route>
         </Switch>
      </Router>
   );
}

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

let initialized = false;
async function setup(opts?: {
   beforeBuild?: (app: App) => Promise<void>;
   onBuilt?: (app: App) => Promise<void>;
}) {
   if (initialized) return;
   initialized = true;

   const connection = new SQLocalConnection({
      databasePath: ":localStorage:",
      verbose: true,
   });

   const app = App.create({
      connection,
      // an initial config is only applied if the database is empty
      initialConfig: {
         data: schema.toJSON(),
      },
      options: {
         // the seed option is only executed if the database was empty
         seed: async (ctx) => {
            await ctx.em.mutator("todos").insertMany([
               { title: "Learn bknd", done: true },
               { title: "Build something cool", done: false },
            ]);

            // @todo: auth is currently not working due to POST request
            /*await ctx.app.module.auth.createUser({
               email: "test@bknd.io",
               password: "12345678",
            });*/
         },
      },
   });

   if (opts?.onBuilt) {
      app.emgr.onEvent(
         App.Events.AppBuiltEvent,
         async () => {
            await opts.onBuilt?.(app);
         },
         "sync",
      );
   }

   await opts?.beforeBuild?.(app);
   await app.build({ sync: true });

   return app;
}
