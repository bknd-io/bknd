import type { PrimaryFieldType } from "bknd";
import { encodeSearch } from "bknd/utils";
import { useLocation, useRouter } from "wouter";
import { useBknd } from "../client/BkndProvider";

export const routes = {
   data: {
      root: () => "/data",
      entity: {
         list: (entity: string) => `/entity/${entity}`,
         create: (entity: string) => `/entity/${entity}/create`,
         edit: (entity: string, id: PrimaryFieldType) => `/entity/${entity}/edit/${id}`,
      },
      schema: {
         root: () => "/schema",
         entity: (entity: string) => `/schema/entity/${entity}`,
      },
   },
   auth: {
      root: () => "/auth",
      users: {
         list: () => "/users",
         edit: (id: PrimaryFieldType) => `/users/edit/${id}`,
      },
      roles: {
         list: () => "/roles",
         edit: (role: string) => `/roles/edit/${role}`,
      },
      settings: () => "/settings",
      strategies: () => "/strategies",
   },
   flows: {
      root: () => "/flows",
      flows: {
         list: () => "/",
         edit: (id: PrimaryFieldType) => `/flow/${id}`,
      },
   },
   settings: {
      root: () => "/settings",
      path: (path: string[]) => `/settings/${path.join("/")}`,
   },
};

export function withQuery(url: string, query: object) {
   const search = encodeSearch(query, { encode: false });
   return `${url}?${search}`;
}

export function withAbsolute(url: string) {
   const { app } = useBknd();
   return app.getAbsolutePath(url);
}

export function useRouteNavigate() {
   const [navigate] = useNavigate();

   return (fn: (r: typeof routes) => string, options?: Parameters<typeof navigate>[1]) => {
      navigate(fn(routes), options);
   };
}

export function useNavigate() {
   const [location, navigate] = useLocation();
   const router = useRouter();
   const { app } = useBknd();
   const basepath = app.options.basepath;
   return [
      (
         url: string,
         options?:
            | {
                 query?: object;
                 absolute?: boolean;
                 replace?: boolean;
                 state?: any;
                 transition?: boolean;
              }
            | { reload: true }
            | { target: string },
      ) => {
         const wrap = (fn: () => void) => {
            fn();
            // prepared for view transition
            /*if (options && "transition" in options && options.transition === false) {
               fn();
            } else {
               document.startViewTransition(fn);
            }*/
         };

         wrap(() => {
            if (options) {
               if ("reload" in options) {
                  window.location.href = url;
                  return;
               } else if ("target" in options) {
                  const _url = window.location.origin + basepath + router.base + url;
                  window.open(_url, options.target);
                  return;
               }
            }

            const _url = options?.absolute ? `~/${basepath}${url}`.replace(/\/+/g, "/") : url;
            const state = {
               ...options?.state,
               referrer: location,
            };

            navigate(options?.query ? withQuery(_url, options?.query) : _url, {
               replace: options?.replace,
               state,
            });
         });
      },
      location,
      (opts?: { fallback?: string }) => {
         const state = window.history.state;
         if (state?.referrer) {
            //window.history.replaceState(state, "", state.referrer);
            navigate(state.referrer, { replace: true });
         } else if (opts?.fallback) {
            navigate(opts.fallback, { replace: true });
         } else {
            window.history.back();
         }
      },
   ] as const;
}

export function useGoBack(
   fallback: string | (() => void) = "/",
   options?: {
      native?: boolean;
      absolute?: boolean;
   },
) {
   const { app } = useBknd();
   const [navigate] = useNavigate();
   const referrer = document.referrer;
   const history_length = window.history.length;
   const same = referrer.length === 0;
   const canGoBack = (same && history_length > 1) || !!same;

   /*console.log("debug", {
      referrer,
      history_length,
      same,
      canGoBack
   });*/

   function goBack() {
      if (same && history_length > 2) {
         //console.log("used history");
         window.history.back();
      } else {
         //console.log("used fallback");
         if (typeof fallback === "string") {
            const _fallback = options?.absolute ? app.getAbsolutePath(fallback) : fallback;
            //console.log("fallback", _fallback);

            if (options?.native) {
               window.location.href = _fallback;
            } else {
               navigate(_fallback);
            }
         } else if (typeof fallback === "function") {
            fallback();
         }
      }
   }

   return {
      same,
      canGoBack,
      goBack,
   };
}
