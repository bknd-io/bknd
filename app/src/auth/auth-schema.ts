import { cookieConfig, jwtConfig } from "auth/authenticate/Authenticator";
import { CustomOAuthStrategy, OAuthStrategy, PasswordStrategy } from "auth/authenticate/strategies";
import { type Static, StringRecord, objectTransform } from "core/utils";
import * as tbbox from "@sinclair/typebox";
const { Type } = tbbox;

export const Strategies = {
   password: {
      cls: PasswordStrategy,
      schema: PasswordStrategy.prototype.getSchema(),
   },
   oauth: {
      cls: OAuthStrategy,
      schema: OAuthStrategy.prototype.getSchema(),
   },
   custom_oauth: {
      cls: CustomOAuthStrategy,
      schema: CustomOAuthStrategy.prototype.getSchema(),
   },
} as const;

export const STRATEGIES = Strategies;
const strategiesSchemaObject = objectTransform(STRATEGIES, (strategy, name) => {
   return Type.Object(
      {
         enabled: Type.Optional(Type.Boolean({ default: true })),
         type: Type.Const(name, { default: name, readOnly: true }),
         config: strategy.schema,
      },
      {
         title: name,
         additionalProperties: false,
      },
   );
});
const strategiesSchema = Type.Union(Object.values(strategiesSchemaObject));
export type AppAuthStrategies = Static<typeof strategiesSchema>;
export type AppAuthOAuthStrategy = Static<typeof STRATEGIES.oauth.schema>;
export type AppAuthCustomOAuthStrategy = Static<typeof STRATEGIES.custom_oauth.schema>;

const guardConfigSchema = Type.Object({
   enabled: Type.Optional(Type.Boolean({ default: false })),
});
export const guardRoleSchema = Type.Object(
   {
      permissions: Type.Optional(Type.Array(Type.String())),
      is_default: Type.Optional(Type.Boolean()),
      implicit_allow: Type.Optional(Type.Boolean()),
   },
   { additionalProperties: false },
);

export const authConfigSchema = Type.Object(
   {
      enabled: Type.Boolean({ default: false }),
      basepath: Type.String({ default: "/api/auth" }),
      entity_name: Type.String({ default: "users" }),
      allow_register: Type.Optional(Type.Boolean({ default: true })),
      jwt: jwtConfig,
      cookie: cookieConfig,
      strategies: Type.Optional(
         StringRecord(strategiesSchema, {
            title: "Strategies",
            default: {
               password: {
                  type: "password",
                  enabled: true,
                  config: {
                     hashing: "sha256",
                  },
               },
            },
         }),
      ),
      guard: Type.Optional(guardConfigSchema),
      roles: Type.Optional(StringRecord(guardRoleSchema, { default: {} })),
   },
   {
      title: "Authentication",
      additionalProperties: false,
   },
);

export type AppAuthSchema = Static<typeof authConfigSchema>;
