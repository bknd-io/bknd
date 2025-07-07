import { cookieConfig, jwtConfig, type Strategy } from "auth/authenticate/Authenticator";
import { objectTransform } from "core/utils";
import { s } from "core/object/schema";
import type { ProvidedOAuthConfig } from "./authenticate/strategies/oauth/OAuthStrategy";
import type { OAuthConfigCustom } from "./authenticate/strategies/oauth/CustomOAuthStrategy";
import { Registry, type Constructor } from "core";
import { PasswordStrategy } from "./authenticate/strategies/PasswordStrategy";
import { OAuthStrategy } from "./authenticate/strategies/oauth/OAuthStrategy";
import { CustomOAuthStrategy } from "./authenticate/strategies/oauth/CustomOAuthStrategy";

export const AuthStrategyRegistry = new Registry<{
   cls: Constructor<Strategy>;
   schema: s.Schema;
}>((cls: Constructor<Strategy>) => ({
   cls,
   schema: cls.prototype.getSchema() as s.Schema,
}))
   .register("password", PasswordStrategy)
   .register("oauth", OAuthStrategy)
   .register("custom_oauth", CustomOAuthStrategy);

export const STRATEGIES = AuthStrategyRegistry.all();
const strategiesSchemaObject = objectTransform(STRATEGIES, (strategy, name) => {
   return s.strictObject(
      {
         enabled: s.boolean({ default: true }).optional(),
         type: s.literal(name),
         config: strategy.schema,
      },
      {
         title: name,
      },
   );
});

const strategiesSchema = s.anyOf(Object.values(strategiesSchemaObject));
export type AppAuthStrategies = s.Static<typeof strategiesSchema>;
export type AppAuthOAuthStrategy = ProvidedOAuthConfig;
export type AppAuthCustomOAuthStrategy = OAuthConfigCustom;

const guardConfigSchema = s.object({
   enabled: s.boolean({ default: false }).optional(),
});
export const guardRoleSchema = s.strictObject({
   permissions: s.array(s.string()).optional(),
   is_default: s.boolean().optional(),
   implicit_allow: s.boolean().optional(),
});

export const authConfigSchema = s.strictObject(
   {
      enabled: s.boolean({ default: false }),
      basepath: s.string({ default: "/api/auth" }),
      entity_name: s.string({ default: "users" }),
      allow_register: s.boolean({ default: true }).optional(),
      jwt: jwtConfig,
      cookie: cookieConfig,
      strategies: s.record(strategiesSchema, {
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
      guard: guardConfigSchema.optional(),
      roles: s.record(guardRoleSchema, { default: {} }).optional(),
   },
   { title: "Authentication" },
);

export type AppAuthJWTConfig = s.Static<typeof jwtConfig>;

export type AppAuthSchema = s.Static<typeof authConfigSchema>;
