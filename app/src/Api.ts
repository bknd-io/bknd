import type { SafeUser } from "auth";
import { AuthApi, type AuthApiOptions } from "auth/api/AuthApi";
import { DataApi, type DataApiOptions } from "data/api/DataApi";
import { decode } from "hono/jwt";
import { MediaApi, type MediaApiOptions } from "media/api/MediaApi";
import { SystemApi } from "modules/SystemApi";
import { omitKeys } from "core/utils";
import type { BaseModuleApiOptions } from "modules";

export type TApiUser = SafeUser;

export type ApiFetcher = (
   input: RequestInfo | URL,
   init?: RequestInit,
) => Response | Promise<Response>;

declare global {
   interface Window {
      __BKND__: {
         user?: TApiUser;
      };
   }
}

type SubApiOptions<T extends BaseModuleApiOptions> = Omit<T, keyof BaseModuleApiOptions>;

export type ApiOptions = {
   host?: string;
   headers?: Headers;
   key?: string;
   storage?: {
      getItem: (key: string) => string | undefined | null | Promise<string | undefined | null>;
      setItem: (key: string, value: string) => void | Promise<void>;
      removeItem: (key: string) => void | Promise<void>;
   };
   onAuthStateChange?: (state: AuthState) => void;
   fetcher?: ApiFetcher;
   verbose?: boolean;
   verified?: boolean;
   data?: SubApiOptions<DataApiOptions>;
   auth?: SubApiOptions<AuthApiOptions>;
   media?: SubApiOptions<MediaApiOptions>;
} & (
   | {
        token?: string;
        user?: TApiUser;
     }
   | {
        request: Request;
     }
);

export type AuthState = {
   token?: string;
   user?: TApiUser;
   verified: boolean;
};

export class Api {
   private token?: string;
   private user?: TApiUser;
   private verified = false;
   private token_transport: "header" | "cookie" | "none" = "header";

   public system!: SystemApi;
   public data!: DataApi;
   public auth!: AuthApi;
   public media!: MediaApi;

   constructor(private options: ApiOptions = {}) {
      // only mark verified if forced
      this.verified = options.verified === true;

      // prefer request if given
      if ("request" in options && options.request) {
         this.options.host = options.host ?? new URL(options.request.url).origin;
         this.options.headers = options.headers ?? options.request.headers;
         this.extractToken();

         // then check for a token
      } else if ("token" in options && options.token) {
         this.token_transport = "header";
         this.updateToken(options.token, { trigger: false });

         // then check for an user object
      } else if ("user" in options && options.user) {
         this.token_transport = "none";
         this.user = options.user;
         this.verified = options.verified !== false;
      } else {
         this.extractToken();
      }

      this.buildApis();
   }

   get fetcher() {
      return this.options.fetcher ?? fetch;
   }

   get baseUrl() {
      return this.options.host ?? "http://localhost";
   }

   get tokenKey() {
      return this.options.key ?? "auth";
   }

   private extractToken() {
      // if token has to be extracted, it's never verified
      this.verified = false;

      if (this.options.headers) {
         // try cookies
         const cookieToken = getCookieValue(this.options.headers.get("cookie"), "auth");
         if (cookieToken) {
            this.token_transport = "cookie";
            this.updateToken(cookieToken);
            return;
         }

         // try authorization header
         const headerToken = this.options.headers.get("authorization")?.replace("Bearer ", "");
         if (headerToken) {
            this.token_transport = "header";
            this.updateToken(headerToken);
            return;
         }
      } else if (this.storage) {
         this.storage.getItem(this.tokenKey).then((token) => {
            this.token_transport = "header";
            this.updateToken(token ? String(token) : undefined);
         });
      }
   }

   private get storage() {
      if (!this.options.storage) return null;
      return {
         getItem: async (key: string) => {
            return await this.options.storage!.getItem(key);
         },
         setItem: async (key: string, value: string) => {
            return await this.options.storage!.setItem(key, value);
         },
         removeItem: async (key: string) => {
            return await this.options.storage!.removeItem(key);
         },
      };
   }

   updateToken(token?: string, opts?: { rebuild?: boolean; trigger?: boolean }) {
      this.token = token;
      this.verified = false;

      if (token) {
         this.user = omitKeys(decode(token).payload as any, ["iat", "iss", "exp"]) as any;
      } else {
         this.user = undefined;
      }

      if (this.storage) {
         const key = this.tokenKey;

         if (token) {
            this.storage.setItem(key, token).then(() => {
               this.options.onAuthStateChange?.(this.getAuthState());
            });
         } else {
            this.storage.removeItem(key).then(() => {
               this.options.onAuthStateChange?.(this.getAuthState());
            });
         }
      } else {
         if (opts?.trigger !== false) {
            this.options.onAuthStateChange?.(this.getAuthState());
         }
      }

      if (opts?.rebuild) this.buildApis();
   }

   private markAuthVerified(verfied: boolean) {
      this.verified = verfied;
      return this;
   }

   isAuthVerified(): boolean {
      return this.verified;
   }

   getAuthState(): AuthState {
      return {
         token: this.token,
         user: this.user,
         verified: this.verified,
      };
   }

   isAuthenticated(): boolean {
      const { token, user } = this.getAuthState();
      return !!token && !!user;
   }

   async getVerifiedAuthState(): Promise<AuthState> {
      await this.verifyAuth();
      return this.getAuthState();
   }

   async verifyAuth() {
      if (!this.token) {
         this.markAuthVerified(false);
         return;
      }

      try {
         const { ok, data } = await this.auth.me();
         const user = data?.user;
         if (!ok || !user) {
            throw new Error();
         }

         this.user = user;
         this.markAuthVerified(true);
      } catch (e) {
         this.markAuthVerified(false);
         this.updateToken(undefined);
      }
   }

   getUser(): TApiUser | null {
      return this.user || null;
   }

   getParams() {
      return Object.freeze({
         host: this.baseUrl,
         token: this.token,
         headers: this.options.headers,
         token_transport: this.token_transport,
         verbose: this.options.verbose,
      });
   }

   private buildApis() {
      const baseParams = this.getParams();
      const fetcher = this.options.fetcher;

      this.system = new SystemApi(baseParams, fetcher);
      this.data = new DataApi(
         {
            ...baseParams,
            ...this.options.data,
         },
         fetcher,
      );
      this.auth = new AuthApi(
         {
            ...baseParams,
            credentials: this.options.storage ? "omit" : "include",
            ...this.options.auth,
            onTokenUpdate: (token) => {
               this.updateToken(token, { rebuild: true });
               this.options.auth?.onTokenUpdate?.(token);
            },
         },
         fetcher,
      );
      this.media = new MediaApi(
         {
            ...baseParams,
            ...this.options.media,
         },
         fetcher,
      );
   }
}

function getCookieValue(cookies: string | null, name: string) {
   if (!cookies) return null;

   for (const cookie of cookies.split("; ")) {
      const [key, value] = cookie.split("=");
      if (key === name && value) {
         return decodeURIComponent(value);
      }
   }
   return null;
}
