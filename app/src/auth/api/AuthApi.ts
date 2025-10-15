import type { AuthActionResponse } from "auth/api/AuthController";
import type { AppAuthSchema } from "auth/auth-schema";
import type { AuthResponse, SafeUser, AuthStrategy } from "bknd";
import { type BaseModuleApiOptions, ModuleApi } from "modules/ModuleApi";

export type AuthApiOptions = BaseModuleApiOptions & {
   onTokenUpdate?: (token?: string, verified?: boolean) => void | Promise<void>;
   credentials?: "include" | "same-origin" | "omit";
};

export class AuthApi extends ModuleApi<AuthApiOptions> {
   protected override getDefaultOptions(): Partial<AuthApiOptions> {
      return {
         basepath: "/api/auth",
         credentials: "include",
      };
   }

   async login(strategy: string, input: any) {
      const res = await this.post<AuthResponse>([strategy, "login"], input);

      if (res.ok && res.body.token) {
         await this.options.onTokenUpdate?.(res.body.token, true);
      }
      return res;
   }

   async register(strategy: string, input: any) {
      const res = await this.post<AuthResponse>([strategy, "register"], input);

      if (res.ok && res.body.token) {
         await this.options.onTokenUpdate?.(res.body.token, true);
      }
      return res;
   }

   async actionSchema(strategy: string, action: string) {
      return this.get<AuthStrategy>([strategy, "actions", action, "schema.json"]);
   }

   async action(strategy: string, action: string, input: any) {
      return this.post<AuthActionResponse>([strategy, "actions", action], input);
   }

   /**
    * @deprecated use login("password", ...) instead
    * @param input
    */
   async loginWithPassword(input: any) {
      return this.login("password", input);
   }

   /**
    * @deprecated use register("password", ...) instead
    * @param input
    */
   async registerWithPassword(input: any) {
      return this.register("password", input);
   }

   me() {
      return this.get<{ user: SafeUser | null }>(["me"]);
   }

   strategies() {
      return this.get<Pick<AppAuthSchema, "strategies" | "basepath">>(["strategies"]);
   }

   async logout() {
      return this.get(["logout"], undefined, {
         headers: {
            // this way bknd detects a json request and doesn't redirect back
            Accept: "application/json",
         },
      }).then(() => this.options.onTokenUpdate?.(undefined, true));
   }
}
