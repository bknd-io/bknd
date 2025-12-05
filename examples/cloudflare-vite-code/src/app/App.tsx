import { Router, Switch, Route } from "wouter";
import Home from "./routes/home.tsx";
import { lazy, Suspense, useEffect, useState } from "react";
const Admin = lazy(() => import("./routes/admin.tsx"));
import { useAuth } from "bknd/client";

export default function App() {
   const auth = useAuth();
   const [verified, setVerified] = useState(false);

   useEffect(() => {
      auth.verify().then(() => setVerified(true));
   }, []);

   if (!verified) return null;

   return (
      <Router>
         <Switch>
            <Route path="/" component={Home} />
            <Route path="/admin/*?">
               <Suspense>
                  <Admin
                     config={{
                        basepath: "/admin",
                        logo_return_path: "/../",
                     }}
                  />
               </Suspense>
            </Route>
            <Route path="*">
               <div className="w-full min-h-full flex justify-center items-center font-mono text-4xl">
                  404
               </div>
            </Route>
         </Switch>
      </Router>
   );
}
