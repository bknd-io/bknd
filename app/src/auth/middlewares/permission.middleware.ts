import type { Permission, PermissionContext } from "auth/authorize/Permission";
import { $console, threw } from "bknd/utils";
import type { Context, Hono } from "hono";
import type { RouterRoute } from "hono/types";
import { createMiddleware } from "hono/factory";
import type { ServerEnv } from "modules/Controller";
import type { MaybePromise } from "core/types";
import { GuardPermissionsException } from "auth/authorize/Guard";

function getPath(reqOrCtx: Request | Context) {
   const req = reqOrCtx instanceof Request ? reqOrCtx : reqOrCtx.req.raw;
   return new URL(req.url).pathname;
}

const permissionSymbol = Symbol.for("permission");

type PermissionMiddlewareOptions<P extends Permission<any, any, any, any>> = {
   onGranted?: (c: Context<ServerEnv>) => MaybePromise<Response | void | undefined>;
   onDenied?: (c: Context<ServerEnv>) => MaybePromise<Response | void | undefined>;
} & (P extends Permission<any, any, infer PC, any>
   ? PC extends undefined
      ? {
           context?: never;
        }
      : {
           context: (c: Context<ServerEnv>) => MaybePromise<PermissionContext<P>>;
        }
   : {
        context?: never;
     });

export function permission<P extends Permission<any, any, any, any>>(
   permission: P,
   options: PermissionMiddlewareOptions<P>,
) {
   // @ts-ignore (middlewares do not always return)
   const handler = createMiddleware<ServerEnv>(async (c, next) => {
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
         const context = (await options?.context?.(c)) ?? ({} as any);

         if (options?.onGranted || options?.onDenied) {
            let returned: undefined | void | Response;
            if (threw(() => guard.granted(permission, c, context), GuardPermissionsException)) {
               returned = await options?.onDenied?.(c);
            } else {
               returned = await options?.onGranted?.(c);
            }
            if (returned instanceof Response) {
               return returned;
            }
         } else {
            guard.granted(permission, c, context);
         }
      }

      await next();
   });

   return Object.assign(handler, {
      [permissionSymbol]: { permission, options },
   });
}

export function getPermissionRoutes(hono: Hono<any>) {
   const routes: {
      route: RouterRoute;
      permission: Permission;
      options: PermissionMiddlewareOptions<Permission>;
   }[] = [];
   for (const route of hono.routes) {
      if (permissionSymbol in route.handler) {
         routes.push({
            route,
            ...(route.handler[permissionSymbol] as any),
         });
      }
   }
   return routes;
}
