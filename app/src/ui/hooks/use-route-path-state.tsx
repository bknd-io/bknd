import { use, createContext, useEffect } from "react";
import { useState } from "react";
import { useLocation, useParams } from "wouter";

// extract path segment from path, e.g. /auth/strategies/:strategy? -> "strategy"
function extractPathSegment(path: string): string {
   const match = path.match(/:(\w+)\??/);
   return match?.[1] ?? "";
}

// get url by replacing path segment with identifier
// e.g. /auth/strategies/:strategy? -> /auth/strategies/x
function getPath(path: string, identifier?: string) {
   if (!identifier) {
      return path.replace(/\/:\w+\??/, "");
   }
   return path.replace(/:\w+\??/, identifier);
}

export function useRoutePathState(_path?: string, identifier?: string) {
   const ctx = useRoutePathContext(_path ?? "");
   const path = _path ?? ctx?.path ?? "";
   const segment = extractPathSegment(path);
   const routeIdentifier = useParams()[segment];
   const [localActive, setLocalActive] = useState(routeIdentifier === identifier);
   const active = ctx ? identifier === ctx.activeIdentifier : localActive;

   const [, navigate] = useLocation();

   function toggle(_open?: boolean) {
      const open = _open ?? !localActive;

      if (ctx) {
         ctx.setActiveIdentifier(identifier!);
      }

      if (path) {
         if (open) {
            navigate(getPath(path, identifier));
         } else {
            navigate(getPath(path));
         }
      } else {
         setLocalActive(open);
      }
   }

   useEffect(() => {
      if (!ctx && _path && identifier) {
         setLocalActive(routeIdentifier === identifier);
      }
   }, [routeIdentifier, identifier, _path]);

   return {
      active,
      toggle,
   };
}

type RoutePathStateContextType = {
   defaultIdentifier: string;
   path: string;
   activeIdentifier: string;
   setActiveIdentifier: (identifier: string) => void;
};
const RoutePathStateContext = createContext<RoutePathStateContextType>(undefined!);

export function RoutePathStateProvider({
   children,
   defaultIdentifier,
   path,
}: Pick<RoutePathStateContextType, "path" | "defaultIdentifier"> & { children: React.ReactNode }) {
   const segment = extractPathSegment(path);
   const routeIdentifier = useParams()[segment];
   const [activeIdentifier, setActiveIdentifier] = useState(routeIdentifier ?? defaultIdentifier);
   return (
      <RoutePathStateContext.Provider
         value={{ defaultIdentifier, path, activeIdentifier, setActiveIdentifier }}
      >
         {children}
      </RoutePathStateContext.Provider>
   );
}

function useRoutePathContext(path?: string) {
   const ctx = use(RoutePathStateContext);
   if (ctx && (!path || ctx.path === path)) {
      return ctx;
   }
   return undefined;
}
