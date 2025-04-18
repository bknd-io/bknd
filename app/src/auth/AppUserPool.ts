import { AppAuth } from "auth/AppAuth";
import type { CreateUser, SafeUser, User, UserPool } from "auth/authenticate/Authenticator";
import { $console } from "core";
import { pick } from "lodash-es";
import {
   InvalidConditionsException,
   UnableToCreateUserException,
   UserNotFoundException,
} from "auth/errors";

export class AppUserPool implements UserPool {
   constructor(private appAuth: AppAuth) {}

   get em() {
      return this.appAuth.em;
   }

   get users() {
      return this.appAuth.getUsersEntity();
   }

   async findBy(strategy: string, prop: keyof SafeUser, value: any) {
      $console.debug("[AppUserPool:findBy]", { strategy, prop, value });
      this.toggleStrategyValueVisibility(true);
      const result = await this.em.repo(this.users).findOne({ [prop]: value, strategy });
      this.toggleStrategyValueVisibility(false);

      if (!result.data) {
         $console.debug("[AppUserPool]: User not found");
         throw new UserNotFoundException();
      }

      return result.data;
   }

   async create(strategy: string, payload: CreateUser & Partial<Omit<User, "id">>) {
      $console.debug("[AppUserPool:create]", { strategy, payload });
      if (!("strategy_value" in payload)) {
         throw new InvalidConditionsException("Profile must have a strategy_value value");
      }

      const fields = this.users.getSelect(undefined, "create");
      const safeProfile = pick(payload, fields) as any;
      const createPayload: Omit<User, "id"> = {
         ...safeProfile,
         strategy,
      };

      const mutator = this.em.mutator(this.users);
      mutator.__unstable_toggleSystemEntityCreation(false);
      this.toggleStrategyValueVisibility(true);
      const createResult = await mutator.insertOne(createPayload);
      mutator.__unstable_toggleSystemEntityCreation(true);
      this.toggleStrategyValueVisibility(false);
      if (!createResult.data) {
         throw new UnableToCreateUserException();
      }

      $console.debug("[AppUserPool]: User created", createResult.data);
      return createResult.data;
   }

   private toggleStrategyValueVisibility(visible: boolean) {
      const toggle = (name: string, visible: boolean) => {
         const field = this.users.field(name)!;

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
}
