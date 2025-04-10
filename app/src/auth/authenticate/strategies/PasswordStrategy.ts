import type { Authenticator, Strategy } from "auth";
import { tbValidator as tb } from "core";
import { hash, parse, type Static, StringEnum, Type } from "core/utils";
import { Hono } from "hono";
import { createStrategyAction, type StrategyActions } from "../Authenticator";

type LoginSchema = { username: string; password: string } | { email: string; password: string };
type RegisterSchema = { email: string; password: string; [key: string]: any };

const schema = Type.Object({
   hashing: StringEnum(["plain", "sha256"] as const, { default: "sha256" }),
});

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

   async login(input: LoginSchema) {
      if (!("email" in input) || !("password" in input)) {
         throw new Error("Invalid input: Email and password must be provided");
      }

      const hashedPassword = await this.hash(input.password);
      return { ...input, password: hashedPassword };
   }

   async register(input: RegisterSchema) {
      if (!input.email || !input.password) {
         throw new Error("Invalid input: Email and password must be provided");
      }

      return {
         ...input,
         password: await this.hash(input.password),
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
                  const payload = await this.login(body);
                  const data = await authenticator.resolve(
                     "login",
                     this,
                     payload.password,
                     payload,
                  );

                  return await authenticator.respond(c, data, redirect);
               } catch (e) {
                  return await authenticator.respond(c, e);
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
               const body = await authenticator.getBody(c);
               const { redirect } = c.req.valid("query");

               const payload = await this.register(body);
               const data = await authenticator.resolve(
                  "register",
                  this,
                  payload.password,
                  payload,
               );

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
