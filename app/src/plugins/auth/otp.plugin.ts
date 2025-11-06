import {
   datetime,
   em,
   entity,
   enumm,
   Exception,
   text,
   DatabaseEvents,
   type App,
   type AppPlugin,
   type DB,
   type FieldSchema,
   type MaybePromise,
   type EntityConfig,
} from "bknd";
import { invariant, s, jsc, HttpStatus, threwAsync, randomString } from "bknd/utils";
import { Hono } from "hono";

export type OtpPluginOptions = {
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
      otp: OtpFieldSchema,
   ) => MaybePromise<{ subject: string; body: string | { text: string; html: string } }>;

   /**
    * Enable debug mode for error messages.
    * @default false
    */
   showActualErrors?: boolean;
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

export type OtpFieldSchema = FieldSchema<typeof otpFields>;

export function otp({
   generateCode: _generateCode,
   apiBasePath = "/api/auth/otp",
   ttl = 600,
   entity: entityName = "users_otp",
   entityConfig,
   generateEmail: _generateEmail,
   showActualErrors = false,
}: OtpPluginOptions = {}): AppPlugin {
   return (app: App) => {
      return {
         name: "bknd-otp",
         schema: () =>
            em(
               {
                  [entityName]: entity(
                     entityName,
                     otpFields,
                     entityConfig ?? {
                        name: "Users OTP",
                        sort_dir: "desc",
                        primary_format: app.module.data.config.default_primary_format,
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
            invariant(auth && auth.enabled === true, "[OTP Plugin]: Auth is not enabled");
            invariant(app.drivers?.email, "[OTP Plugin]: Email driver is not registered");

            const generateCode =
               _generateCode ?? (() => Math.floor(100000 + Math.random() * 900000).toString());
            const generateEmail =
               _generateEmail ??
               ((otp: OtpFieldSchema) => ({
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
                        code: s.string().optional(),
                     }),
                  ),
                  async (c) => {
                     const { email, code } = c.req.valid("json");
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
                        return auth.authenticator.respondWithUser(c, { user, token: jwt });
                     } else {
                        await generateAndSendCode(
                           app,
                           { generateCode, generateEmail, ttl, entity: entityName },
                           user,
                           "login",
                        );

                        return c.json({ sent: true, action: "login" }, HttpStatus.CREATED);
                     }
                  },
               )
               .post(
                  "/register",
                  jsc(
                     "json",
                     s.object({
                        email: s.string({ format: "email" }),
                        code: s.string().optional(),
                     }),
                  ),
                  async (c) => {
                     const { email, code } = c.req.valid("json");

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
                           password: randomString(16, true),
                        });

                        const jwt = await auth.authenticator.jwt(user);
                        // @ts-expect-error private method
                        return auth.authenticator.respondWithUser(c, { user, token: jwt });
                     } else {
                        await generateAndSendCode(
                           app,
                           { generateCode, generateEmail, ttl, entity: entityName },
                           { email },
                           "register",
                        );

                        return c.json({ sent: true, action: "register" }, HttpStatus.CREATED);
                     }
                  },
               )
               .onError((err) => {
                  if (showActualErrors) {
                     throw err;
                  }

                  throw new Exception("Invalid credentials", HttpStatus.BAD_REQUEST);
               });

            app.server.route(apiBasePath, hono);

            // just for now, prevent mutations of the OTP entity
            registerListeners(app, entityName);
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

async function generateAndSendCode(
   app: App,
   opts: Required<Pick<OtpPluginOptions, "generateCode" | "generateEmail" | "ttl" | "entity">>,
   user: Pick<DB["users"], "email">,
   action: OtpFieldSchema["action"],
) {
   const { generateCode, generateEmail, ttl, entity: entityName } = opts;
   const newCode = generateCode?.(user);
   if (!newCode) {
      throw new Exception("[OTP Plugin]: Failed to generate code");
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

   const { subject, body } = await generateEmail(otpData);
   await app.drivers?.email?.send(user.email, subject, body);

   return otpData;
}

async function getValidatedCode(
   app: App,
   entityName: string,
   email: string,
   code: string,
   action: OtpFieldSchema["action"],
) {
   invariant(email, "[OTP Plugin]: Email is required");
   invariant(code, "[OTP Plugin]: Code is required");
   const em = app.em.fork();
   const { data: otpData } = await em.repo(entityName).findOne({ email, code, action });
   if (!otpData) {
      throw new Exception("Invalid code", HttpStatus.BAD_REQUEST);
   }

   if (otpData.expires_at < new Date()) {
      throw new Exception("Code expired", HttpStatus.GONE);
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
         { expires_at: new Date(Date.now() - ttl * 1000) },
         { email, used_at: { $isnull: true } },
      );
}

function registerListeners(app: App, entityName: string) {
   app.emgr.onAny(
      (event) => {
         let allowed = true;
         let action = "";
         if (event instanceof DatabaseEvents.MutatorInsertBefore) {
            if (event.params.entity.name === entityName) {
               allowed = false;
               action = "create";
            }
         } else if (event instanceof DatabaseEvents.MutatorUpdateBefore) {
            if (event.params.entity.name === entityName) {
               allowed = false;
               action = "update";
            }
         }

         if (!allowed) {
            throw new Exception(`[OTP Plugin]: Not allowed to ${action} OTP codes manually`);
         }
      },
      {
         mode: "sync",
         id: "bknd-otp",
      },
   );
}
