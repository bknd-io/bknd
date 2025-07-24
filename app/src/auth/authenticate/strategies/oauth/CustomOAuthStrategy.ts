import type * as oauth from "oauth4webapi";
import { OAuthStrategy } from "./OAuthStrategy";
import { s } from "bknd/utils";

type SupportedTypes = "oauth2" | "oidc";

type RequireKeys<T extends object, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;

const UrlString = s.string({ pattern: "^(https?|wss?)://[^\\s/$.?#].[^\\s]*$" });
const oauthSchemaCustom = s.strictObject(
   {
      type: s.string({ enum: ["oidc", "oauth2"] as const, default: "oidc" }),
      name: s.string(),
      client: s.object({
         client_id: s.string(),
         client_secret: s.string(),
         token_endpoint_auth_method: s.string({ enum: ["client_secret_basic"] }),
      }),
      as: s.strictObject({
         issuer: s.string(),
         code_challenge_methods_supported: s.string({ enum: ["S256"] }).optional(),
         scopes_supported: s.array(s.string()).optional(),
         scope_separator: s.string({ default: " " }).optional(),
         authorization_endpoint: UrlString.optional(),
         token_endpoint: UrlString.optional(),
         userinfo_endpoint: UrlString.optional(),
      }),
      // @todo: profile mapping
   },
   { title: "Custom OAuth" },
);

type OAuthConfigCustom = s.Static<typeof oauthSchemaCustom>;

export type UserProfile = {
   sub: string;
   email: string;
   [key: string]: any;
};

export type IssuerConfig<UserInfo = any> = {
   type: SupportedTypes;
   client: RequireKeys<oauth.Client, "token_endpoint_auth_method">;
   as: oauth.AuthorizationServer & {
      scope_separator?: string;
   };
   profile: (
      info: UserInfo,
      config: Omit<IssuerConfig, "profile">,
      tokenResponse: any,
   ) => Promise<UserProfile>;
};

export class CustomOAuthStrategy extends OAuthStrategy {
   constructor(config: OAuthConfigCustom) {
      super(config as any);
      this.type = "custom_oauth";
   }

   override getIssuerConfig(): IssuerConfig {
      return { ...this.config, profile: async (info) => info } as any;
   }

   // @ts-ignore
   override getSchema() {
      return oauthSchemaCustom;
   }
}
