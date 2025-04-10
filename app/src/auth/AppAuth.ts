import {
   type AuthAction,
   AuthPermissions,
   Authenticator,
   type ProfileExchange,
   Role,
   type Strategy,
} from "auth";
import type { PasswordStrategy } from "auth/authenticate/strategies";
import { $console, type DB, Exception, type PrimaryFieldType } from "core";
import { secureRandomString, transformObject } from "core/utils";
import type { Entity, EntityManager } from "data";
import { type FieldSchema, em, entity, enumm, text } from "data/prototype";
import { pick } from "lodash-es";
import { Module } from "modules/Module";
import { AuthController } from "./api/AuthController";
import { type AppAuthSchema, STRATEGIES, authConfigSchema } from "./auth-schema";
import type { AuthResolveOptions } from "auth/authenticate/Authenticator";

export type UserFieldSchema = FieldSchema<typeof AppAuth.usersFields>;
declare module "core" {
   interface DB {
      users: { id: PrimaryFieldType } & UserFieldSchema;
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

      this._authenticator = new Authenticator(strategies, this.resolveUser.bind(this), {
         jwt: this.config.jwt,
         cookie: this.config.cookie,
      });

      this.registerEntities();
      super.setBuilt();

      this._controller = new AuthController(this);
      this.ctx.server.route(this.config.basepath, this._controller.getController());
      this.ctx.guard.registerPermissions(Object.values(AuthPermissions));
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

   private async resolveUser(
      action: AuthAction,
      strategy: Strategy,
      profile: ProfileExchange,
      opts?: AuthResolveOptions,
   ): Promise<any> {
      if (!this.config.allow_register && action === "register") {
         throw new Exception("Registration is not allowed", 403);
      }

      const identifier = opts?.identifier || "email";
      if (typeof identifier !== "string" || identifier.length === 0) {
         throw new Exception("Identifier must be a string");
      }
      if (!(identifier in profile)) {
         throw new Exception(`Profile must have identifier "${identifier}"`);
      }

      switch (action) {
         case "login":
            return this.login(strategy, profile, { identifier });
         case "register":
            return this.register(strategy, profile, { identifier });
      }
   }

   private filterUserData(user: any) {
      return pick(user, this.config.jwt.fields);
   }

   private async login(strategy: Strategy, profile: ProfileExchange, opts: AuthResolveOptions) {
      const users = this.getUsersEntity();
      this.toggleStrategyValueVisibility(true);
      const result = await this.em
         .repo(users as unknown as "users")
         .findOne({ [opts.identifier]: profile[opts.identifier]! });
      this.toggleStrategyValueVisibility(false);
      if (!result.data) {
         throw new Exception("User not found", 404);
      }

      // compare strategy and identifier
      if (result.data.strategy !== strategy.getName()) {
         throw new Exception("User registered with different strategy");
      }

      return result.data;
   }

   private async register(strategy: Strategy, profile: ProfileExchange, opts: AuthResolveOptions) {
      if (!("strategy_value" in profile)) {
         throw new Exception("Profile must have a strategy value");
      }

      const users = this.getUsersEntity();
      const { data } = await this.em
         .repo(users)
         .findOne({ [opts.identifier]: profile[opts.identifier]! });
      if (data) {
         throw new Exception("User already exists");
      }

      const payload: any = {
         ...profile,
         strategy: strategy.getName(),
      };

      const mutator = this.em.mutator(users);
      mutator.__unstable_toggleSystemEntityCreation(false);
      this.toggleStrategyValueVisibility(true);
      const createResult = await mutator.insertOne(payload);
      mutator.__unstable_toggleSystemEntityCreation(true);
      this.toggleStrategyValueVisibility(false);
      if (!createResult.data) {
         throw new Error("Could not create user");
      }

      //return this.filterUserData(createResult.data);
      return createResult.data;
   }

   private toggleStrategyValueVisibility(visible: boolean) {
      const toggle = (name: string, visible: boolean) => {
         const field = this.getUsersEntity().field(name)!;

         if (visible) {
            field.config.hidden = false;
            field.config.fillable = true;
         } else {
            // reset to normal
            const template = AppAuth.usersFields.strategy_value.config;
            field.config.hidden = template.hidden;
            field.config.fillable = template.fillable;
         }
      };

      toggle("strategy_value", visible);
      toggle("strategy", visible);

      // @todo: think about a PasswordField that automatically hashes on save?
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
            type: strategy.getType(),
            config: strategy.toJSON(secrets),
         })),
      };
   }
}
