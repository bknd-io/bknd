import { Api, type ApiOptions, type TApiUser } from "Api";
import { isDebug } from "core";
import { createContext, type ReactNode, useContext } from "react";
import type { AdminBkndWindowContext } from "modules/server/AdminController";

const ClientContext = createContext<{ baseUrl: string; api: Api }>({
   baseUrl: undefined,
} as any);

export type ClientProviderProps = {
   children?: ReactNode;
} & (
   | { baseUrl?: string; user?: TApiUser | null | undefined }
   | {
        api: Api;
     }
);

export const ClientProvider = ({ children, ...props }: ClientProviderProps) => {
   let api: Api;

   if (props && "api" in props) {
      api = props.api;
   } else {
      const winCtx = useBkndWindowContext();
      const _ctx_baseUrl = useBaseUrl();
      const { baseUrl, user } = props;
      let actualBaseUrl = baseUrl ?? _ctx_baseUrl ?? "";

      try {
         if (!baseUrl) {
            if (_ctx_baseUrl) {
               actualBaseUrl = _ctx_baseUrl;
               console.warn("wrapped many times, take from context", actualBaseUrl);
            } else if (typeof window !== "undefined") {
               actualBaseUrl = window.location.origin;
               //console.log("setting from window", actualBaseUrl);
            }
         }
      } catch (e) {
         console.error("Error in ClientProvider", e);
      }

      //console.log("api init", { host: actualBaseUrl, user: user ?? winCtx.user });
      api = new Api({ host: actualBaseUrl, user: user ?? winCtx.user, verbose: isDebug() });
   }

   return (
      <ClientContext.Provider value={{ baseUrl: api.baseUrl, api }}>
         {children}
      </ClientContext.Provider>
   );
};

export const useApi = (host?: ApiOptions["host"]): Api => {
   const context = useContext(ClientContext);
   if (!context?.api || (host && host.length > 0 && host !== context.baseUrl)) {
      return new Api({ host: host ?? "" });
   }

   return context.api;
};

/**
 * @deprecated use useApi().baseUrl instead
 */
export const useBaseUrl = () => {
   const context = useContext(ClientContext);
   return context.baseUrl;
};

export function useBkndWindowContext(): AdminBkndWindowContext {
   const defaults = {
      logout_route: "/api/auth/logout",
      admin_basepath: "",
   };

   if (typeof window !== "undefined" && window.__BKND__) {
      return {
         ...defaults,
         ...window.__BKND__,
      };
   }

   return defaults;
}
