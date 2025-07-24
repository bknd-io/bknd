import { type AppAuth, AuthPermissions, type SafeUser, type Strategy } from "auth";
import { TypeInvalidError, parse, transformObject } from "core/utils";
import { DataPermissions } from "data";
import type { Hono } from "hono";
import { Controller, type ServerEnv } from "modules/Controller";
import { describeRoute, jsc, s } from "core/object/schema";

export type AuthActionResponse = {
   success: boolean;
   action: string;
   data?: SafeUser;
   errors?: any;
};

export class AuthController extends Controller {
   constructor(private auth: AppAuth) {
      super();
   }

   get guard() {
      return this.auth.ctx.guard;
   }

   get em() {
      return this.auth.ctx.em;
   }

   get userRepo() {
      const entity_name = this.auth.config.entity_name;
      return this.em.repo(entity_name as "users");
   }

   private registerStrategyActions(strategy: Strategy, mainHono: Hono<ServerEnv>) {
      if (!this.auth.isStrategyEnabled(strategy)) {
         return;
      }
      const actions = strategy.getActions?.();
      if (!actions) {
         return;
      }

      const { auth, permission } = this.middlewares;
      const hono = this.create().use(auth());

      const name = strategy.getName();
      const { create, change } = actions;
      const em = this.auth.em;

      if (create) {
         hono.post(
            "/create",
            permission([AuthPermissions.createUser, DataPermissions.entityCreate]),
            describeRoute({
               summary: "Create a new user",
               tags: ["auth"],
            }),
            async (c) => {
               try {
                  const body = await this.auth.authenticator.getBody(c);
                  const valid = parse(create.schema, body, {
                     skipMark: true,
                  });
                  const processed = (await create.preprocess?.(valid)) ?? valid;

                  // @todo: check processed for "role" and check permissions
                  const mutator = em.mutator(this.auth.config.entity_name as "users");
                  mutator.__unstable_toggleSystemEntityCreation(false);
                  const { data: created } = await mutator.insertOne({
                     ...processed,
                     strategy: name,
                  });
                  mutator.__unstable_toggleSystemEntityCreation(true);

                  return c.json({
                     success: true,
                     action: "create",
                     strategy: name,
                     data: created as unknown as SafeUser,
                  } as AuthActionResponse);
               } catch (e) {
                  if (e instanceof TypeInvalidError) {
                     return c.json(
                        {
                           success: false,
                           errors: e.errors,
                        },
                        400,
                     );
                  }
                  throw e;
               }
            },
         );
         hono.get(
            "create/schema.json",
            describeRoute({
               summary: "Get the schema for creating a user",
               tags: ["auth"],
            }),
            async (c) => {
               return c.json(create.schema);
            },
         );
      }

      mainHono.route(`/${name}/actions`, hono);
   }

   override getController() {
      const { auth } = this.middlewares;
      const hono = this.create();

      hono.get(
         "/me",
         describeRoute({
            summary: "Get the current user",
            tags: ["auth"],
         }),
         auth(),
         async (c) => {
            const claims = c.get("auth")?.user;
            if (claims) {
               const { data: user } = await this.userRepo.findId(claims.id);
               await this.auth.authenticator?.requestCookieRefresh(c);
               return c.json({ user });
            }

            return c.json({ user: null }, 403);
         },
      );

      hono.get(
         "/logout",
         describeRoute({
            summary: "Logout the current user",
            tags: ["auth"],
         }),
         auth(),
         async (c) => {
            await this.auth.authenticator.logout(c);
            if (this.auth.authenticator.isJsonRequest(c)) {
               return c.json({ ok: true });
            }

            const referer = c.req.header("referer");
            if (referer) {
               return c.redirect(referer);
            }

            return c.redirect("/");
         },
      );

      hono.get(
         "/strategies",
         describeRoute({
            summary: "Get the available authentication strategies",
            tags: ["auth"],
         }),
         jsc("query", s.object({ include_disabled: s.boolean().optional() })),
         async (c) => {
            const { include_disabled } = c.req.valid("query");
            const { strategies, basepath } = this.auth.toJSON(false);

            if (!include_disabled) {
               return c.json({
                  strategies: transformObject(strategies ?? {}, (strategy, name) => {
                     return this.auth.isStrategyEnabled(name) ? strategy : undefined;
                  }),
                  basepath,
               });
            }

            return c.json({ strategies, basepath });
         },
      );

      const strategies = this.auth.authenticator.getStrategies();

      for (const [name, strategy] of Object.entries(strategies)) {
         if (!this.auth.isStrategyEnabled(strategy)) continue;

         hono.route(`/${name}`, strategy.getController(this.auth.authenticator));
         this.registerStrategyActions(strategy, hono);
      }

      return hono;
   }
}
