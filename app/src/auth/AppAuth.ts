import { Authenticator, AuthPermissions, Role, type Strategy } from "auth";
import type { PasswordStrategy } from "auth/authenticate/strategies";
import { $console, type DB } from "core";
import { secureRandomString, transformObject } from "core/utils";
import type { Entity, EntityManager } from "data";
import { em, entity, enumm, type FieldSchema, text } from "data/prototype";
import { Module } from "modules/Module";
import { AuthController } from "./api/AuthController";
import { type AppAuthSchema, authConfigSchema, STRATEGIES } from "./auth-schema";
import { AppUserPool } from "auth/AppUserPool";
import type { AppEntity } from "core/config";

export type UserFieldSchema = FieldSchema<typeof AppAuth.usersFields>;
declare module "core" {
   interface Users extends AppEntity, UserFieldSchema {}
   interface DB {
      users: Users;
   }
}

export type CreateUserPayload = { email: string; password: string; [key: string]: any };

export class AppAuth extends Module<typeof authConfigSchema> {
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
         return Role.create({ name, ...role });
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
      });

      this.registerEntities();
      super.setBuilt();

      this._controller = new AuthController(this);
      this.ctx.server.route(this.config.basepath, this._controller.getController());
      this.ctx.guard.registerPermissions(AuthPermissions);
   }

   isStrategyEnabled(strategy: Strategy | string) {
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

   static usersFields = {
      email: text().required(),
      strategy: text({
         fillable: ["create"],
         hidden: ["update", "form"],
      }).required(),
      strategy_value: text({
         fillable: ["create"],
         hidden: ["read", "table", "update", "form"],
      }).required(),
      role: text(),
   };

   registerEntities() {
      const users = this.getUsersEntity(true);
      this.ensureSchema(
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
         this.replaceEntityField(users, "role", enumm({ enum: roles }));
      } catch (e) {}

      try {
         // also keep disabled strategies as a choice
         const strategies = Object.keys(this.config.strategies ?? {});
         this.replaceEntityField(users, "strategy", enumm({ enum: strategies }));
      } catch (e) {}
   }

   async createUser({ email, password, ...additional }: CreateUserPayload): Promise<DB["users"]> {
      if (!this.enabled) {
         throw new Error("Cannot create user, auth not enabled");
      }

      const strategy = "password" as const;
      const pw = this.authenticator.strategy(strategy) as PasswordStrategy;
      const strategy_value = await pw.hash(password);
      const mutator = this.em.mutator(this.config.entity_name as "users");
      mutator.__unstable_toggleSystemEntityCreation(false);
      const { data: created } = await mutator.insertOne({
         ...(additional as any),
         email,
         strategy,
         strategy_value,
      });
      mutator.__unstable_toggleSystemEntityCreation(true);
      return created;
   }

   override toJSON(secrets?: boolean): AppAuthSchema {
      if (!this.config.enabled) {
         return this.configDefault;
      }

      const strategies = this.authenticator.getStrategies();

      return {
         ...this.config,
         ...this.authenticator.toJSON(secrets),
         strategies: transformObject(strategies, (strategy) => ({
            enabled: this.isStrategyEnabled(strategy),
            ...strategy.toJSON(secrets),
         })),
      };
   }
}
