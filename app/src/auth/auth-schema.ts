import { Registry, type Constructor } from "core/registry/Registry";
import { cookieConfig, jwtConfig } from "auth/authenticate/Authenticator";
import { objectTransform, s } from "bknd/utils";
import type { ProvidedOAuthConfig } from "./authenticate/strategies/oauth/OAuthStrategy";
import type { OAuthConfigCustom } from "./authenticate/strategies/oauth/CustomOAuthStrategy";
import { PasswordStrategy } from "./authenticate/strategies/PasswordStrategy";
import { OAuthStrategy } from "./authenticate/strategies/oauth/OAuthStrategy";
import { CustomOAuthStrategy } from "./authenticate/strategies/oauth/CustomOAuthStrategy";
import type { AuthStrategy } from "auth/authenticate/strategies/Strategy";

export const AuthStrategyRegistry = new Registry<{
   cls: Constructor<AuthStrategy>;
   schema: s.Schema;
}>((cls: Constructor<AuthStrategy>) => ({
   cls,
   schema: cls.prototype.getSchema() as s.Schema,
}))
   .register("password", PasswordStrategy)
   .register("oauth", OAuthStrategy)
   .register("custom_oauth", CustomOAuthStrategy);

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

export function buildAuthSchema() {
   const strategiesSchemaObject = objectTransform(AuthStrategyRegistry.all(), (strategy, name) => {
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
   return s.strictObject(
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
}
export const authConfigSchema = buildAuthSchema();

export type AppAuthStrategies = s.Static<(typeof authConfigSchema)["properties"]["strategies"]>;
export type AppAuthJWTConfig = s.Static<typeof jwtConfig>;
export type AppAuthSchema = s.Static<typeof authConfigSchema>;
