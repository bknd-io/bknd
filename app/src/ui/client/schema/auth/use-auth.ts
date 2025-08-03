import type { AuthState } from "Api";
import type { AuthResponse } from "bknd";
import { useApi, useInvalidate } from "ui/client";
import { useClientContext } from "ui/client/ClientProvider";

type LoginData = {
   email: string;
   password: string;
   [key: string]: any;
};

type UseAuth = {
   data: Partial<AuthState> | undefined;
   user: AuthState["user"] | undefined;
   token: AuthState["token"] | undefined;
   verified: boolean;
   login: (data: LoginData) => Promise<AuthResponse>;
   register: (data: LoginData) => Promise<AuthResponse>;
   logout: () => void;
   verify: () => void;
   setToken: (token: string) => void;
};

export const useAuth = (options?: { baseUrl?: string }): UseAuth => {
   const api = useApi(options?.baseUrl);
   const invalidate = useInvalidate();
   const { authState } = useClientContext();
   const verified = authState?.verified ?? false;

   async function login(input: LoginData) {
      const res = await api.auth.login("password", input);
      return res.data;
   }

   async function register(input: LoginData) {
      const res = await api.auth.register("password", input);
      return res.data;
   }

   function setToken(token: string) {
      api.updateToken(token);
   }

   async function logout() {
      api.updateToken(undefined);
      invalidate();
   }

   async function verify() {
      await api.verifyAuth();
   }

   return {
      data: authState,
      user: authState?.user,
      token: authState?.token,
      verified,
      login,
      register,
      logout,
      setToken,
      verify,
   };
};
