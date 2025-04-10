import type { Authenticator, ProfileExchange, Strategy, User } from "auth";
import { Exception, tbValidator as tb } from "core";
import { hash, parse, type Static, StringEnum, Type } from "core/utils";
import { Hono } from "hono";
import { createStrategyAction, type StrategyActions } from "../Authenticator";
import { genSalt as bcryptGenSalt, hash as bcryptHash, compare as bcryptCompare } from "bcryptjs";

type LoginSchema = { username: string; password: string } | { email: string; password: string };
type RegisterSchema = { email: string; password: string; [key: string]: any };

const schema = Type.Union([
   Type.Object(
      {
         hashing: StringEnum(["plain", "sha256"]),
      },
      {
         additionalProperties: false,
      },
   ),
   Type.Object(
      {
         hashing: Type.Const("bcrypt"),
         rounds: Type.Number({ minimum: 1, maximum: 10 }),
      },
      {
         additionalProperties: false,
      },
   ),
]);

export type PasswordStrategyOptions = Static<typeof schema>;

export class PasswordStrategy implements Strategy {
   private options: PasswordStrategyOptions;

   constructor(options: Partial<PasswordStrategyOptions> = {}) {
      this.options = parse(schema, options);
   }

   async hash(password: string) {
      switch (this.options.hashing) {
         case "sha256":
            return hash.sha256(password);
         default:
            return password;
      }
   }

   async compare(user: ProfileExchange, compare: string): Promise<boolean> {
      switch (this.options.hashing) {
         case "sha256":
            return user.password === (await this.hash(compare));
      }

      return false;
   }

   async register(input: RegisterSchema) {
      if (!input.email || !input.password) {
         throw new Error("Invalid input: Email and password must be provided");
      }

      return {
         email: input.email,
         strategy_value: await this.hash(input.password),
      };
   }

   getController(authenticator: Authenticator): Hono<any> {
      const hono = new Hono();

      return hono
         .post(
            "/login",
            tb(
               "query",
               Type.Object({
                  redirect: Type.Optional(Type.String()),
               }),
            ),
            async (c) => {
               const body = await authenticator.getBody(c);
               const { redirect } = c.req.valid("query");

               try {
                  if (!("email" in body) || !("password" in body)) {
                     throw new Error("Invalid input: Email and password must be provided");
                  }
                  const user = await authenticator.resolve("login", this, body);

                  // compare
                  if (!this.compare(user, body.password)) {
                     throw new Exception("Invalid credentials");
                  }

                  const data = await authenticator.safeAuthResponse(user);
                  return await authenticator.respond(c, data, redirect);
               } catch (e) {
                  return await authenticator.respond(c, e as Error);
               }
            },
         )
         .post(
            "/register",
            tb(
               "query",
               Type.Object({
                  redirect: Type.Optional(Type.String()),
               }),
            ),
            async (c) => {
               const { redirect } = c.req.valid("query");
               const { password, email, ...body } = await authenticator.getBody(c);
               if (!email || !password) {
                  throw new Error("Invalid input: Email and password must be provided");
               }

               const user = await authenticator.resolve("register", this, {
                  //...body, // for now, don't add body, but prepare
                  email,
                  strategy_value: await this.hash(password),
               });

               const data = await authenticator.safeAuthResponse(user);

               return await authenticator.respond(c, data, redirect);
            },
         );
   }

   getActions(): StrategyActions {
      return {
         create: createStrategyAction(
            Type.Object({
               email: Type.String({
                  pattern: "^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$",
               }),
               password: Type.String({
                  minLength: 8, // @todo: this should be configurable
               }),
            }),
            async ({ password, ...input }) => {
               return {
                  ...input,
                  strategy_value: await this.hash(password),
               };
            },
         ),
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
