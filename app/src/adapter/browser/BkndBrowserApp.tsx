import {
   createContext,
   lazy,
   Suspense,
   useContext,
   useEffect,
   useState,
   type ReactNode,
} from "react";
import { checksum } from "bknd/utils";
import { App, registries, sqlocal, type BkndConfig } from "bknd";
import { Route, Router, Switch } from "wouter";
import { type Api, ClientProvider } from "bknd/client";
import { SQLocalKysely } from "sqlocal/kysely";
import type { ClientConfig, DatabasePath } from "sqlocal";
import { OpfsStorageAdapter } from "bknd/adapter/browser";
import type { BkndAdminConfig } from "bknd/ui";

const Admin = lazy(() =>
   Promise.all([
      import("bknd/ui"),
      // @ts-ignore
      import("bknd/dist/styles.css"),
   ]).then(([mod]) => ({
      default: mod.Admin,
   })),
);

function safeViewTransition(fn: () => void) {
   if (document.startViewTransition) {
      document.startViewTransition(fn);
   } else {
      fn();
   }
}

export type BrowserBkndConfig<Args = ImportMetaEnv> = Omit<
   BkndConfig<Args>,
   "connection" | "app"
> & {
   adminConfig?: BkndAdminConfig;
   connection?: ClientConfig | DatabasePath;
};

export type BkndBrowserAppProps = {
   children: ReactNode;
   loading?: ReactNode;
   notFound?: ReactNode;
} & BrowserBkndConfig;

const BkndBrowserAppContext = createContext<{
   app: App;
   hash: string;
}>(undefined!);

export function BkndBrowserApp({
   children,
   adminConfig,
   loading,
   notFound,
   ...config
}: BkndBrowserAppProps) {
   const [app, setApp] = useState<App | undefined>(undefined);
   const [api, setApi] = useState<Api | undefined>(undefined);
   const [hash, setHash] = useState<string>("");
   const adminRoutePath = (adminConfig?.basepath ?? "") + "/*?";

   async function onBuilt(app: App) {
      safeViewTransition(async () => {
         setApp(app);
         setApi(app.getApi());
         setHash(await checksum(app.toJSON()));
      });
   }

   useEffect(() => {
      setup({ ...config, adminConfig })
         .then((app) => onBuilt(app as any))
         .catch(console.error);
   }, []);

   if (!app || !api) {
      return (
         loading ?? (
            <Center>
               <span style={{ opacity: 0.2 }}>Loading...</span>
            </Center>
         )
      );
   }

   return (
      <BkndBrowserAppContext.Provider value={{ app, hash }}>
         <ClientProvider api={api}>
            <Router key={hash}>
               <Switch>
                  {children}

                  <Route path={adminRoutePath}>
                     <Suspense>
                        <Admin config={adminConfig} />
                     </Suspense>
                  </Route>
                  <Route path="*">
                     {notFound ?? (
                        <Center style={{ fontSize: "48px", fontFamily: "monospace" }}>404</Center>
                     )}
                  </Route>
               </Switch>
            </Router>
         </ClientProvider>
      </BkndBrowserAppContext.Provider>
   );
}

export function useApp() {
   return useContext(BkndBrowserAppContext);
}

const Center = (props: React.HTMLAttributes<HTMLDivElement>) => (
   <div
      {...props}
      style={{
         width: "100%",
         minHeight: "100vh",
         display: "flex",
         justifyContent: "center",
         alignItems: "center",
         ...(props.style ?? {}),
      }}
   />
);

let initialized = false;
async function setup(config: BrowserBkndConfig = {}) {
   if (initialized) return;
   initialized = true;

   registries.media.register("opfs", OpfsStorageAdapter);

   const app = App.create({
      ...config,
      // @ts-ignore
      connection: sqlocal(new SQLocalKysely(config.connection ?? ":localStorage:")),
   });

   await config.beforeBuild?.(app);
   await app.build({ sync: true });
   await config.onBuilt?.(app);

   return app;
}
