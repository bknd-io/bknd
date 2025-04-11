import { type Authenticator, InvalidCredentialsException, type Strategy, type User } from "auth";
import { $console, tbValidator as tb } from "core";
import { Const, hash, parse, type Static, StrictObject, StringEnum } from "core/utils";
import { Hono } from "hono";
import { createStrategyAction, type StrategyActions } from "../Authenticator";
import { compare as bcryptCompare, genSalt as bcryptGenSalt, hash as bcryptHash } from "bcryptjs";
import * as tbbox from "@sinclair/typebox";
const { Type } = tbbox;

const schema = StrictObject({
   hashing: StringEnum(["plain", "sha256", "bcrypt"]),
   rounds: Type.Optional(Type.Number({ minimum: 1, maximum: 10 })),
});

export type PasswordStrategyOptions = Static<typeof schema>;

export class PasswordStrategy implements Strategy {
   private options: PasswordStrategyOptions;

   constructor(options: Partial<PasswordStrategyOptions> = {}) {
      this.options = parse(schema, options);
   }

   private getPayloadSchema() {
      return Type.Object({
         email: Type.String({
            pattern: "^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$",
         }),
         password: Type.String({
            minLength: 8, // @todo: this should be configurable
         }),
      });
   }

   async hash(password: string) {
      switch (this.options.hashing) {
         case "sha256":
            return hash.sha256(password);
         case "bcrypt": {
            const salt = await bcryptGenSalt(this.options.rounds ?? 4);
            return bcryptHash(password, salt);
         }
         default:
            return password;
      }
   }

   async compare(actual: string, compare: string): Promise<boolean> {
      switch (this.options.hashing) {
         case "sha256": {
            const compareHashed = await this.hash(compare);
            return actual === compareHashed;
         }
         case "bcrypt":
            return await bcryptCompare(compare, actual);
      }

      return false;
   }

   verify(password: string) {
      return async (user: User) => {
         const compare = await this.compare(user?.strategy_value!, password);
         if (compare !== true) {
            throw new InvalidCredentialsException();
         }
      };
   }

   getController(authenticator: Authenticator): Hono<any> {
      const hono = new Hono();
      const redirectQuerySchema = Type.Object({
         redirect: Type.Optional(Type.String()),
      });
      const payloadSchema = this.getPayloadSchema();

      hono.post("/login", tb("query", redirectQuerySchema), async (c) => {
         const body = parse(payloadSchema, await authenticator.getBody(c), {
            onError: (errors) => {
               $console.error("Invalid login payload", [...errors]);
               throw new InvalidCredentialsException();
            },
         });
         const { redirect } = c.req.valid("query");

         return await authenticator.resolveLogin(c, this, body, this.verify(body.password), {
            redirect,
         });
      });

      hono.post("/register", tb("query", redirectQuerySchema), async (c) => {
         const { redirect } = c.req.valid("query");
         const { password, email, ...body } = parse(payloadSchema, await authenticator.getBody(c), {
            onError: (errors) => {
               $console.error("Invalid register payload", [...errors]);
               throw new InvalidCredentialsException();
            },
         });

         const profile = {
            ...body,
            email,
            strategy_value: await this.hash(password),
         };

         return await authenticator.resolveRegister(c, this, profile, async () => void 0, {
            redirect,
         });
      });

      return hono;
   }

   getActions(): StrategyActions {
      return {
         create: createStrategyAction(this.getPayloadSchema(), async ({ password, ...input }) => {
            return {
               ...input,
               strategy_value: await this.hash(password),
            };
         }),
      };
   }

   getSchema() {
      return schema;
   }

   getType() {
      return "password";
   }

   getMode() {
      return "form" as const;
   }

   getName() {
      return "password" as const;
   }

   toJSON(secrets?: boolean) {
      return secrets ? this.options : undefined;
   }
}
