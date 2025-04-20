import { type Static, StringEnum } from "core/utils";
import * as tbbox from "@sinclair/typebox";
import type * as oauth from "oauth4webapi";
import { OAuthStrategy } from "./OAuthStrategy";
const { Type } = tbbox;

type SupportedTypes = "oauth2" | "oidc";

type RequireKeys<T extends object, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;

const UrlString = Type.String({ pattern: "^(https?|wss?)://[^\\s/$.?#].[^\\s]*$" });
const oauthSchemaCustom = Type.Object(
   {
      type: StringEnum(["oidc", "oauth2"] as const, { default: "oidc" }),
      name: Type.String(),
      client: Type.Object(
         {
            client_id: Type.String(),
            client_secret: Type.String(),
            token_endpoint_auth_method: StringEnum(["client_secret_basic"]),
         },
         {
            additionalProperties: false,
         },
      ),
      as: Type.Object(
         {
            issuer: Type.String(),
            code_challenge_methods_supported: Type.Optional(StringEnum(["S256"])),
            scopes_supported: Type.Optional(Type.Array(Type.String())),
            scope_separator: Type.Optional(Type.String({ default: " " })),
            authorization_endpoint: Type.Optional(UrlString),
            token_endpoint: Type.Optional(UrlString),
            userinfo_endpoint: Type.Optional(UrlString),
         },
         {
            additionalProperties: false,
         },
      ),
      // @todo: profile mapping
   },
   { title: "Custom OAuth", additionalProperties: false },
);

type OAuthConfigCustom = Static<typeof oauthSchemaCustom>;

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
   override getIssuerConfig(): IssuerConfig {
      return { ...this.config, profile: async (info) => info } as any;
   }

   // @ts-ignore
   override getSchema() {
      return oauthSchemaCustom;
   }

   override getType() {
      return "custom_oauth";
   }
}
