import {
   datetime,
   em,
   entity,
   enumm,
   Exception,
   text,
   type App,
   type AppPlugin,
   type DB,
   type FieldSchema,
   type MaybePromise,
   type EntityConfig,
   DatabaseEvents,
} from "bknd";
import {
   invariant,
   s,
   jsc,
   HttpStatus,
   threwAsync,
   randomString,
   $console,
   pickKeys,
} from "bknd/utils";
import { Hono } from "hono";

export type EmailOTPPluginOptions = {
   /**
    * Customize code generation. If not provided, a random 6-digit code will be generated.
    */
   generateCode?: (user: Pick<DB["users"], "email">) => string;

   /**
    * The base path for the API endpoints.
    * @default "/api/auth/otp"
    */
   apiBasePath?: string;

   /**
    * The TTL for the OTP tokens in seconds.
    * @default 600 (10 minutes)
    */
   ttl?: number;

   /**
    * The name of the OTP entity.
    * @default "users_otp"
    */
   entity?: string;

   /**
    * The config for the OTP entity.
    */
   entityConfig?: EntityConfig;

   /**
    * Customize email content. If not provided, a default email will be sent.
    */
   generateEmail?: (
      otp: EmailOTPFieldSchema,
   ) => MaybePromise<{ subject: string; body: string | { text: string; html: string } }>;

   /**
    * Enable debug mode for error messages.
    * @default false
    */
   showActualErrors?: boolean;

   /**
    * Allow direct mutations (create/update) of OTP codes outside of this plugin,
    * e.g. via API or admin UI. If false, mutations are only allowed via the plugin's flows.
    * @default false
    */
   allowExternalMutations?: boolean;

   /**
    * Whether to send the email with the OTP code.
    * @default true
    */
   sendEmail?: boolean;
};

const otpFields = {
   action: enumm({
      enum: ["login", "register"],
   }),
   code: text().required(),
   email: text().required(),
   created_at: datetime(),
   expires_at: datetime().required(),
   used_at: datetime(),
};

export type EmailOTPFieldSchema = FieldSchema<typeof otpFields>;

class OTPError extends Exception {
   override name = "OTPError";
   override code = HttpStatus.BAD_REQUEST;
}

export function emailOTP({
   generateCode: _generateCode,
   apiBasePath = "/api/auth/otp",
   ttl = 600,
   entity: entityName = "users_otp",
   entityConfig,
   generateEmail: _generateEmail,
   showActualErrors = false,
   allowExternalMutations = false,
   sendEmail = true,
}: EmailOTPPluginOptions = {}): AppPlugin {
   return (app: App) => {
      return {
         name: "email-otp",
         schema: () =>
            em(
               {
                  [entityName]: entity(
                     entityName,
                     otpFields,
                     {
                        name: "Users OTP",
                        sort_dir: "desc",
                        primary_format: app.module.data.config.default_primary_format,
                        ...entityConfig,
                     },
                     "generated",
                  ),
               },
               ({ index }, schema) => {
                  const otp = schema[entityName]!;
                  index(otp).on(["email", "expires_at", "code"]);
               },
            ),
         onBuilt: async () => {
            const auth = app.module.auth;
            invariant(auth && auth.enabled === true, "Auth is not enabled");
            invariant(!sendEmail || app.drivers?.email, "Email driver is not registered");

            const generateCode =
               _generateCode ?? (() => Math.floor(100000 + Math.random() * 900000).toString());
            const generateEmail =
               _generateEmail ??
               ((otp: EmailOTPFieldSchema) => ({
                  subject: "OTP Code",
                  body: `Your OTP code is: ${otp.code}`,
               }));
            const em = app.em.fork();

            const hono = new Hono()
               .post(
                  "/login",
                  jsc(
                     "json",
                     s.object({
                        email: s.string({ format: "email" }),
                        code: s.string({ minLength: 1 }).optional(),
                     }),
                  ),
                  jsc("query", s.object({ redirect: s.string().optional() })),
                  async (c) => {
                     const { email, code } = c.req.valid("json");
                     const { redirect } = c.req.valid("query");
                     const user = await findUser(app, email);

                     if (code) {
                        const otpData = await getValidatedCode(
                           app,
                           entityName,
                           email,
                           code,
                           "login",
                        );
                        await em.mutator(entityName).updateOne(otpData.id, { used_at: new Date() });

                        const jwt = await auth.authenticator.jwt(user);
                        // @ts-expect-error private method
                        return auth.authenticator.respondWithUser(
                           c,
                           { user, token: jwt },
                           { redirect },
                        );
                     } else {
                        const otpData = await invalidateAndGenerateCode(
                           app,
                           { generateCode, ttl, entity: entityName },
                           user,
                           "login",
                        );
                        if (sendEmail) {
                           await sendCode(app, otpData, { generateEmail });
                        }

                        return c.json(
                           {
                              sent: true,
                              data: pickKeys(otpData, ["email", "action", "expires_at"]),
                           },
                           HttpStatus.CREATED,
                        );
                     }
                  },
               )
               .post(
                  "/register",
                  jsc(
                     "json",
                     s.object({
                        email: s.string({ format: "email" }),
                        code: s.string({ minLength: 1 }).optional(),
                     }),
                  ),
                  jsc("query", s.object({ redirect: s.string().optional() })),
                  async (c) => {
                     const { email, code } = c.req.valid("json");
                     const { redirect } = c.req.valid("query");

                     // throw if user exists
                     if (!(await threwAsync(findUser(app, email)))) {
                        throw new Exception("User already exists", HttpStatus.BAD_REQUEST);
                     }

                     if (code) {
                        const otpData = await getValidatedCode(
                           app,
                           entityName,
                           email,
                           code,
                           "register",
                        );
                        await em.mutator(entityName).updateOne(otpData.id, { used_at: new Date() });

                        const user = await app.createUser({
                           email,
                           password: randomString(32, true),
                        });

                        const jwt = await auth.authenticator.jwt(user);
                        // @ts-expect-error private method
                        return auth.authenticator.respondWithUser(
                           c,
                           { user, token: jwt },
                           { redirect },
                        );
                     } else {
                        const otpData = await invalidateAndGenerateCode(
                           app,
                           { generateCode, ttl, entity: entityName },
                           { email },
                           "register",
                        );
                        if (sendEmail) {
                           await sendCode(app, otpData, { generateEmail });
                        }

                        return c.json(
                           {
                              sent: true,
                              data: pickKeys(otpData, ["email", "action", "expires_at"]),
                           },
                           HttpStatus.CREATED,
                        );
                     }
                  },
               )
               .onError((err) => {
                  if (showActualErrors || err instanceof OTPError) {
                     throw err;
                  }

                  throw new Exception("Invalid credentials", HttpStatus.BAD_REQUEST);
               });

            app.server.route(apiBasePath, hono);

            if (allowExternalMutations !== true) {
               registerListeners(app, entityName);
            }
         },
      };
   };
}

async function findUser(app: App, email: string) {
   const user_entity = app.module.auth.config.entity_name as "users";
   const { data: user } = await app.em.repo(user_entity).findOne({ email });
   if (!user) {
      throw new Exception("User not found", HttpStatus.BAD_REQUEST);
   }

   return user;
}

async function invalidateAndGenerateCode(
   app: App,
   opts: Required<Pick<EmailOTPPluginOptions, "generateCode" | "ttl" | "entity">>,
   user: Pick<DB["users"], "email">,
   action: EmailOTPFieldSchema["action"],
) {
   const { generateCode, ttl, entity: entityName } = opts;
   const newCode = generateCode?.(user);
   if (!newCode) {
      throw new OTPError("Failed to generate code");
   }

   await invalidateAllUserCodes(app, entityName, user.email, ttl);
   const { data: otpData } = await app.em
      .fork()
      .mutator(entityName)
      .insertOne({
         code: newCode,
         email: user.email,
         action,
         created_at: new Date(),
         expires_at: new Date(Date.now() + ttl * 1000),
      });

   $console.log("[OTP Code]", newCode);

   return otpData;
}

async function sendCode(
   app: App,
   otpData: EmailOTPFieldSchema,
   opts: Required<Pick<EmailOTPPluginOptions, "generateEmail">>,
) {
   const { generateEmail } = opts;
   const { subject, body } = await generateEmail(otpData);
   await app.drivers?.email?.send(otpData.email, subject, body);
}

async function getValidatedCode(
   app: App,
   entityName: string,
   email: string,
   code: string,
   action: EmailOTPFieldSchema["action"],
) {
   invariant(email, "[OTP Plugin]: Email is required");
   invariant(code, "[OTP Plugin]: Code is required");
   const em = app.em.fork();
   const { data: otpData } = await em.repo(entityName).findOne({ email, code, action });
   if (!otpData) {
      throw new OTPError("Invalid code");
   }

   if (otpData.expires_at < new Date()) {
      throw new OTPError("Code expired");
   }

   if (otpData.used_at) {
      throw new OTPError("Code already used");
   }

   return otpData;
}

async function invalidateAllUserCodes(app: App, entityName: string, email: string, ttl: number) {
   invariant(ttl > 0, "[OTP Plugin]: TTL must be greater than 0");
   invariant(email, "[OTP Plugin]: Email is required");
   const em = app.em.fork();
   await em
      .mutator(entityName)
      .updateWhere(
         { expires_at: new Date(Date.now() - 1000) },
         { email, used_at: { $isnull: true } },
      );
}

function registerListeners(app: App, entityName: string) {
   [DatabaseEvents.MutatorInsertBefore, DatabaseEvents.MutatorUpdateBefore].forEach((event) => {
      app.emgr.onEvent(
         event,
         (e: { params: { entity: { name: string } } }) => {
            if (e.params.entity.name === entityName) {
               throw new OTPError("Mutations of the OTP entity are not allowed");
            }
         },
         {
            mode: "sync",
            id: "bknd-email-otp",
         },
      );
   });
}
