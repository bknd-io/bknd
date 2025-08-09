import { cookieConfig, jwtConfig } from "auth/authenticate/Authenticator";
import { CustomOAuthStrategy, OAuthStrategy, PasswordStrategy } from "auth/authenticate/strategies";
import { objectTransform, s } from "bknd/utils";
import { $object, $record } from "modules/mcp";

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
export type AppAuthOAuthStrategy = s.Static<typeof STRATEGIES.oauth.schema>;
export type AppAuthCustomOAuthStrategy = s.Static<typeof STRATEGIES.custom_oauth.schema>;

const guardConfigSchema = s.object({
   enabled: s.boolean({ default: false }).optional(),
});
export const guardRoleSchema = s.strictObject({
   permissions: s.array(s.string()).optional(),
   is_default: s.boolean().optional(),
   implicit_allow: s.boolean().optional(),
});

export const authConfigSchema = $object(
   "config_auth",
   {
      enabled: s.boolean({ default: false }),
      basepath: s.string({ default: "/api/auth" }),
      entity_name: s.string({ default: "users" }),
      allow_register: s.boolean({ default: true }).optional(),
      jwt: jwtConfig,
      cookie: cookieConfig,
      strategies: $record(
         "config_auth_strategies",
         strategiesSchema,
         {
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
         },
         s.strictObject({
            type: s.string(),
            config: s.object({}),
         }),
      ),
      guard: guardConfigSchema.optional(),
      roles: $record("config_auth_roles", guardRoleSchema, { default: {} }).optional(),
   },
   { title: "Authentication" },
);

export type AppAuthJWTConfig = s.Static<typeof jwtConfig>;

export type AppAuthSchema = s.Static<typeof authConfigSchema>;
