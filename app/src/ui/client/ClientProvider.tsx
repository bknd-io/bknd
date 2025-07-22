import { Api, type ApiOptions, type AuthState } from "Api";
import { isDebug } from "core/env";
import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import type { AdminBkndWindowContext } from "modules/server/AdminController";

export type BkndClientContext = {
   baseUrl: string;
   api: Api;
   authState?: Partial<AuthState>;
};

const ClientContext = createContext<BkndClientContext>(undefined!);

export type ClientProviderProps = {
   children?: ReactNode;
   baseUrl?: string;
} & ApiOptions;

export const ClientProvider = ({
   children,
   host,
   baseUrl: _baseUrl = host,
   ...props
}: ClientProviderProps) => {
   const winCtx = useBkndWindowContext();
   const _ctx = useClientContext();
   let actualBaseUrl = _baseUrl ?? _ctx?.baseUrl ?? "";
   let user: any = undefined;

   if (winCtx) {
      user = winCtx.user;
   }

   if (!actualBaseUrl) {
      try {
         actualBaseUrl = window.location.origin;
      } catch (e) {}
   }

   const apiProps = { user, ...props, host: actualBaseUrl };
   const api = useMemo(
      () =>
         new Api({
            ...apiProps,
            verbose: isDebug(),
            onAuthStateChange: (state) => {
               props.onAuthStateChange?.(state);
               if (!authState?.token || state.token !== authState?.token) {
                  setAuthState(state);
               }
            },
         }),
      [JSON.stringify(apiProps)],
   );

   const [authState, setAuthState] = useState<Partial<AuthState> | undefined>(
      apiProps.user ? api.getAuthState() : undefined,
   );

   return (
      <ClientContext.Provider value={{ baseUrl: api.baseUrl, api, authState }}>
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

export const useClientContext = () => {
   return useContext(ClientContext);
};

/**
 * @deprecated use useApi().baseUrl instead
 */
export const useBaseUrl = () => {
   const context = useClientContext();
   return context?.baseUrl;
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
