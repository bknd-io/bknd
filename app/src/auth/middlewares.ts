import type { Permission } from "core";
import { $console, patternMatch } from "core/utils";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { ServerEnv } from "modules/Controller";

function getPath(reqOrCtx: Request | Context) {
   const req = reqOrCtx instanceof Request ? reqOrCtx : reqOrCtx.req.raw;
   return new URL(req.url).pathname;
}

export function shouldSkip(c: Context<ServerEnv>, skip?: (string | RegExp)[]) {
   const authCtx = c.get("auth");
   if (!authCtx) {
      throw new Error("auth ctx not found");
   }

   if (authCtx.skip) return true;

   const req = c.req.raw;
   if (!skip) return false;

   const path = getPath(req);
   const result = skip.some((s) => patternMatch(path, s));

   authCtx.skip = result;
   return result;
}

export const auth = (options?: {
   skip?: (string | RegExp)[];
}) =>
   createMiddleware<ServerEnv>(async (c, next) => {
      if (!c.get("auth")) {
         c.set("auth", {
            registered: false,
            resolved: false,
            skip: false,
            user: undefined,
         });
      }

      const app = c.get("app");
      const authCtx = c.get("auth")!;
      const authenticator = app?.module.auth.authenticator;

      let skipped = shouldSkip(c, options?.skip) || !app?.module.auth.enabled;

      // make sure to only register once
      if (authCtx.registered) {
         skipped = true;
         $console.warn(`auth middleware already registered for ${getPath(c)}`);
      } else {
         authCtx.registered = true;

         if (!skipped && !authCtx.resolved && app?.module.auth.enabled) {
            authCtx.user = await authenticator?.resolveAuthFromRequest(c);
            authCtx.resolved = true;
         }
      }

      await next();
      // @todo: potentially add cookie refresh if content-type html and about to expire

      // release
      authCtx.skip = false;
      authCtx.resolved = false;
      authCtx.user = undefined;
   });

export const permission = (
   permission: Permission | Permission[],
   options?: {
      onGranted?: (c: Context<ServerEnv>) => Promise<Response | void | undefined>;
      onDenied?: (c: Context<ServerEnv>) => Promise<Response | void | undefined>;
   },
) =>
   // @ts-ignore
   createMiddleware<ServerEnv>(async (c, next) => {
      const app = c.get("app");
      const authCtx = c.get("auth");
      if (!authCtx) {
         throw new Error("auth ctx not found");
      }

      // in tests, app is not defined
      if (!authCtx.registered || !app) {
         const msg = `auth middleware not registered, cannot check permissions for ${getPath(c)}`;
         if (app?.module.auth.enabled) {
            throw new Error(msg);
         } else {
            $console.warn(msg);
         }
      } else if (!authCtx.skip) {
         const guard = app.modules.ctx().guard;
         const permissions = Array.isArray(permission) ? permission : [permission];

         if (options?.onGranted || options?.onDenied) {
            let returned: undefined | void | Response;
            if (permissions.every((p) => guard.granted(p, c))) {
               returned = await options?.onGranted?.(c);
            } else {
               returned = await options?.onDenied?.(c);
            }
            if (returned instanceof Response) {
               return returned;
            }
         } else {
            permissions.some((p) => guard.throwUnlessGranted(p, c));
         }
      }

      await next();
   });
