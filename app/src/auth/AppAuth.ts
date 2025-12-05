import type { DB, PrimaryFieldType } from "bknd";
import * as AuthPermissions from "auth/auth-permissions";
import type { AuthStrategy } from "auth/authenticate/strategies/Strategy";
import type { PasswordStrategy } from "auth/authenticate/strategies/PasswordStrategy";
import { $console, secureRandomString, transformObject, pickKeys } from "bknd/utils";
import type { Entity, EntityManager } from "data/entities";
import { em, entity, enumm, type FieldSchema } from "data/prototype";
import { Module } from "modules/Module";
import { AuthController } from "./api/AuthController";
import { type AppAuthSchema, authConfigSchema, STRATEGIES } from "./auth-schema";
import { AppUserPool } from "auth/AppUserPool";
import type { AppEntity } from "core/config";
import { usersFields } from "./auth-entities";
import { Authenticator } from "./authenticate/Authenticator";
import { Role } from "./authorize/Role";

export type UsersFields = typeof AppAuth.usersFields;
export type UserFieldSchema = FieldSchema<typeof AppAuth.usersFields>;
declare module "bknd" {
   interface Users extends AppEntity, UserFieldSchema {}
   interface DB {
      users: Users;
   }
}

export type CreateUserPayload = { email: string; password: string; [key: string]: any };

export class AppAuth extends Module<AppAuthSchema> {
   private _authenticator?: Authenticator;
   cache: Record<string, any> = {};
   _controller!: AuthController;

   override async onBeforeUpdate(from: AppAuthSchema, to: AppAuthSchema) {
      const defaultSecret = authConfigSchema.properties.jwt.properties.secret.default;

      if (!from.enabled && to.enabled) {
         if (to.jwt.secret === defaultSecret) {
            $console.warn("No JWT secret provided, generating a random one");
            to.jwt.secret = secureRandomString(64);
         }
      }

      // @todo: password strategy is required atm
      if (!to.strategies?.password?.enabled) {
         $console.warn("Password strategy cannot be disabled.");
         to.strategies!.password!.enabled = true;
      }

      if (to.default_role_register && to.default_role_register?.length > 0) {
         const valid_to_role = Object.keys(to.roles ?? {}).includes(to.default_role_register);

         if (!valid_to_role) {
            const msg = `Default role for registration not found: ${to.default_role_register}`;
            // if changing to a new value
            if (from.default_role_register !== to.default_role_register) {
               throw new Error(msg);
            }

            // resetting gracefully, since role doesn't exist anymore
            $console.warn(`${msg}, resetting to undefined`);
            to.default_role_register = undefined;
         }
      }

      return to;
   }

   get enabled() {
      return this.config.enabled;
   }

   override async build() {
      if (!this.enabled) {
         this.setBuilt();
         return;
      }

      // register roles
      const roles = transformObject(this.config.roles ?? {}, (role, name) => {
         return Role.create(name, role);
      });
      this.ctx.guard.setRoles(Object.values(roles));
      this.ctx.guard.setConfig(this.config.guard ?? {});

      // build strategies
      const strategies = transformObject(this.config.strategies ?? {}, (strategy, name) => {
         try {
            return new STRATEGIES[strategy.type].cls(strategy.config as any);
         } catch (e) {
            throw new Error(
               `Could not build strategy ${String(
                  name,
               )} with config ${JSON.stringify(strategy.config)}`,
            );
         }
      });

      this._authenticator = new Authenticator(strategies, new AppUserPool(this), {
         jwt: this.config.jwt,
         cookie: this.config.cookie,
         default_role_register: this.config.default_role_register,
      });

      this.registerEntities();
      super.setBuilt();

      this._controller = new AuthController(this);
      this._controller.registerMcp();
      this.ctx.server.route(this.config.basepath, this._controller.getController());
      this.ctx.guard.registerPermissions(AuthPermissions);
   }

   isStrategyEnabled(strategy: AuthStrategy | string) {
      const name = typeof strategy === "string" ? strategy : strategy.getName();
      // for now, password is always active
      if (name === "password") return true;

      return this.config.strategies?.[name]?.enabled ?? false;
   }

   get controller(): AuthController {
      if (!this.isBuilt()) {
         throw new Error("Can't access controller, AppAuth not built yet");
      }

      return this._controller;
   }

   getSchema() {
      return authConfigSchema;
   }

   getGuardContextSchema() {
      const userschema = this.getUsersEntity().toSchema() as any;
      return {
         type: "object",
         properties: {
            user: {
               type: "object",
               properties: pickKeys(userschema.properties, this.config.jwt.fields as any),
            },
         },
      };
   }

   get authenticator(): Authenticator {
      this.throwIfNotBuilt();
      return this._authenticator!;
   }

   get em(): EntityManager {
      return this.ctx.em as any;
   }

   getUsersEntity(forceCreate?: boolean): Entity<"users", typeof AppAuth.usersFields> {
      const entity_name = this.config.entity_name;
      if (forceCreate || !this.em.hasEntity(entity_name)) {
         return entity(entity_name as "users", AppAuth.usersFields, undefined, "system");
      }

      return this.em.entity(entity_name) as any;
   }

   static usersFields = usersFields;

   registerEntities() {
      const users = this.getUsersEntity(true);
      this.ctx.helper.ensureSchema(
         em(
            {
               [users.name as "users"]: users,
            },
            ({ index }, { users }) => {
               index(users).on(["email"], true).on(["strategy"]).on(["strategy_value"]);
            },
         ),
      );

      try {
         const roles = Object.keys(this.config.roles ?? {});
         this.ctx.helper.replaceEntityField(users, "role", enumm({ enum: roles }));
      } catch (e) {}

      try {
         // also keep disabled strategies as a choice
         const strategies = Object.keys(this.config.strategies ?? {});
         this.ctx.helper.replaceEntityField(users, "strategy", enumm({ enum: strategies }));
      } catch (e) {}
   }

   async createUser({
      email,
      password,
      role,
      ...additional
   }: CreateUserPayload): Promise<DB["users"]> {
      if (!this.enabled) {
         throw new Error("Cannot create user, auth not enabled");
      }
      if (role) {
         if (!Object.keys(this.config.roles ?? {}).includes(role)) {
            throw new Error(`Role "${role}" not found`);
         }
      }

      const strategy = "password" as const;
      const pw = this.authenticator.strategy(strategy) as PasswordStrategy;
      const strategy_value = await pw.hash(password);
      const mutator = this.em.mutator(this.config.entity_name as "users");
      mutator.__unstable_toggleSystemEntityCreation(false);
      const { data: created } = await mutator.insertOne({
         ...(additional as any),
         role: role || this.config.default_role_register || undefined,
         email,
         strategy,
         strategy_value,
      });
      mutator.__unstable_toggleSystemEntityCreation(true);
      return created;
   }

   async changePassword(userId: PrimaryFieldType, newPassword: string) {
      const users_entity = this.config.entity_name as "users";
      const { data: user } = await this.em.repository(users_entity).findId(userId);
      if (!user) {
         throw new Error("User not found");
      } else if (user.strategy !== "password") {
         throw new Error("User is not using password strategy");
      }

      const togglePw = (visible: boolean) => {
         const field = this.em.entity(users_entity).field("strategy_value")!;

         field.config.hidden = !visible;
         field.config.fillable = visible;
      };

      const pw = this.authenticator.strategy("password" as const) as PasswordStrategy;
      togglePw(true);
      await this.em.mutator(users_entity).updateOne(user.id, {
         strategy_value: await pw.hash(newPassword),
      });
      togglePw(false);

      return true;
   }

   override toJSON(secrets?: boolean): AppAuthSchema {
      if (!this.config.enabled) {
         return this.configDefault;
      }

      const strategies = this.authenticator.getStrategies();
      const roles = Object.fromEntries(this.ctx.guard.getRoles().map((r) => [r.name, r.toJSON()]));

      return {
         ...this.config,
         ...this.authenticator.toJSON(secrets),
         roles,
         strategies: transformObject(strategies, (strategy) => ({
            enabled: this.isStrategyEnabled(strategy),
            ...strategy.toJSON(secrets),
         })),
      } as AppAuthSchema;
   }
}
