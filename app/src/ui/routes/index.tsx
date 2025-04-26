import { Suspense, lazy, type ComponentType, type ReactNode } from "react";
import { useTheme } from "ui/client/use-theme";
import { Route, Router, Switch } from "wouter";
import AuthRoutes from "./auth";
import { AuthLogin } from "./auth/auth.login";
import DataRoutes from "./data";
import FlowRoutes from "./flows";
import MediaRoutes from "./media";
import { Root, RootEmpty } from "./root";
import SettingsRoutes from "./settings";
import { FlashMessage } from "ui/modules/server/FlashMessage";
import { AuthRegister } from "ui/routes/auth/auth.register";
import { BkndModalsProvider } from "ui/modals";
import { useBkndWindowContext } from "ui/client";

// @ts-ignore
const TestRoutes = lazy(() => import("./test"));

export function Routes({
   BkndWrapper,
   basePath = "",
}: { BkndWrapper: ComponentType<{ children: ReactNode }>; basePath?: string }) {
   const { theme } = useTheme();
   const ctx = useBkndWindowContext();
   const actualBasePath = basePath || ctx.admin_basepath;

   return (
      <div id="bknd-admin" className={theme + " antialiased"}>
         <FlashMessage />
         <Router base={actualBasePath}>
            <Switch>
               <Route path="/auth/login" component={AuthLogin} />
               <Route path="/auth/register" component={AuthRegister} />

               <BkndWrapper>
                  <BkndModalsProvider>
                     <Route path="/" nest>
                        <Root>
                           <Switch>
                              <Route path="/test*" nest>
                                 <Suspense fallback={null}>
                                    <TestRoutes />
                                 </Suspense>
                              </Route>

                              <Route path="/" component={RootEmpty} />
                              <Route path="/data" nest>
                                 <Suspense fallback={null}>
                                    <DataRoutes />
                                 </Suspense>
                              </Route>
                              <Route path="/flows" nest>
                                 <Suspense fallback={null}>
                                    <FlowRoutes />
                                 </Suspense>
                              </Route>
                              <Route path="/auth" nest>
                                 <Suspense fallback={null}>
                                    <AuthRoutes />
                                 </Suspense>
                              </Route>
                              <Route path="/media" nest>
                                 <Suspense fallback={null}>
                                    <MediaRoutes />
                                 </Suspense>
                              </Route>
                              <Route path="/settings" nest>
                                 <Suspense fallback={null}>
                                    <SettingsRoutes />
                                 </Suspense>
                              </Route>

                              <Route path="*" component={NotFound} />
                           </Switch>
                        </Root>
                     </Route>
                  </BkndModalsProvider>
               </BkndWrapper>
            </Switch>
         </Router>
      </div>
   );
}

function NotFound() {
   return (
      <div className="flex w-full items-center justify-center">
         <p className="text-2xl font-mono">
            <span className="font-bold">404</span>
            <span className="opacity-50">, Sorry :)</span>
         </p>
      </div>
   );
}
