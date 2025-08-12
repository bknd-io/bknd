import type { User } from "bknd";
import type { Authenticator } from "auth/authenticate/Authenticator";
import { InvalidCredentialsException } from "auth/errors";
import { hash, $console, s, parse, jsc } from "bknd/utils";
import { Hono } from "hono";
import { compare as bcryptCompare, genSalt as bcryptGenSalt, hash as bcryptHash } from "bcryptjs";
import { AuthStrategy } from "./Strategy";

const schema = s
   .object({
      hashing: s.string({ enum: ["plain", "sha256", "bcrypt"], default: "sha256" }),
      rounds: s.number({ minimum: 1, maximum: 10 }).optional(),
   })
   .strict();

export type PasswordStrategyOptions = s.Static<typeof schema>;

export class PasswordStrategy extends AuthStrategy<typeof schema> {
   constructor(config: Partial<PasswordStrategyOptions> = {}) {
      super(config as any, "password", "password", "form");

      this.registerAction("create", this.getPayloadSchema(), async ({ password, ...input }) => {
         return {
            ...input,
            strategy_value: await this.hash(password),
         };
      });
   }

   getSchema() {
      return schema;
   }

   private getPayloadSchema() {
      return s.object({
         email: s.string({
            format: "email",
         }),
         password: s.string({
            minLength: 8, // @todo: this should be configurable
         }),
      });
   }

   async hash(password: string) {
      switch (this.config.hashing) {
         case "sha256":
            return hash.sha256(password);
         case "bcrypt": {
            const salt = await bcryptGenSalt(this.config.rounds ?? 4);
            return bcryptHash(password, salt);
         }
         default:
            return password;
      }
   }

   async compare(actual: string, compare: string): Promise<boolean> {
      switch (this.config.hashing) {
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
      const redirectQuerySchema = s.object({
         redirect: s.string().optional(),
      });
      const payloadSchema = this.getPayloadSchema();

      hono.post("/login", jsc("query", redirectQuerySchema), async (c) => {
         try {
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
         } catch (e) {
            return authenticator.respondWithError(c, e as any);
         }
      });

      hono.post("/register", jsc("query", redirectQuerySchema), async (c) => {
         try {
            const { redirect } = c.req.valid("query");
            const { password, email, ...body } = parse(
               payloadSchema,
               await authenticator.getBody(c),
               {
                  onError: (errors) => {
                     $console.error("Invalid register payload", [...errors]);
                     new InvalidCredentialsException();
                  },
               },
            );

            const profile = {
               ...body,
               email,
               strategy_value: await this.hash(password),
            };

            return await authenticator.resolveRegister(c, this, profile, async () => void 0, {
               redirect,
            });
         } catch (e) {
            return authenticator.respondWithError(c, e as any);
         }
      });

      return hono;
   }
}
