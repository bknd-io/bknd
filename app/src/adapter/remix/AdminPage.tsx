import { useAuth } from "bknd/client";
import type { BkndAdminProps } from "bknd/ui";
import { Suspense, lazy, useEffect, useState } from "react";

export function adminPage(props?: BkndAdminProps) {
   const Admin = lazy(() => import("bknd/ui").then((mod) => ({ default: mod.Admin })));
   return () => {
      const auth = useAuth();
      const [loaded, setLoaded] = useState(false);
      useEffect(() => {
         if (typeof window === "undefined") return;
         setLoaded(true);
      }, []);
      if (!loaded) return null;

      return (
         <Suspense>
            <Admin withProvider={{ user: auth.user }} {...props} />
         </Suspense>
      );
   };
}
