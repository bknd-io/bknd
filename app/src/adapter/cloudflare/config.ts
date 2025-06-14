/// <reference types="@cloudflare/workers-types" />

import { registerMedia } from "./storage/StorageR2Adapter";
import { getBinding } from "./bindings";
import { D1Connection } from "./connection/D1Connection";
import type { CloudflareBkndConfig, CloudflareEnv } from ".";
import { App } from "bknd";
import { makeConfig as makeAdapterConfig } from "bknd/adapter";
import type { Context, ExecutionContext } from "hono";
import { $console } from "core";
import { setCookie } from "hono/cookie";
import { sqlite } from "bknd/adapter/sqlite";

export const constants = {
   exec_async_event_id: "cf_register_waituntil",
   cache_endpoint: "/__bknd/cache",
   do_endpoint: "/__bknd/do",
   d1_session: {
      cookie: "cf_d1_session",
      header: "x-cf-d1-session",
   },
};

export type CfMakeConfigArgs<Env extends CloudflareEnv = CloudflareEnv> = {
   env: Env;
   ctx?: ExecutionContext;
   request?: Request;
};

function getCookieValue(cookies: string | null, name: string) {
   if (!cookies) return null;

   for (const cookie of cookies.split("; ")) {
      const [key, value] = cookie.split("=");
      if (key === name && value) {
         return decodeURIComponent(value);
      }
   }
   return null;
}

export function d1SessionHelper(config: CloudflareBkndConfig<any>) {
   const headerKey = constants.d1_session.header;
   const cookieKey = constants.d1_session.cookie;
   const transport = config.d1?.transport;

   return {
      get: (request?: Request): D1SessionBookmark | undefined => {
         if (!request || !config.d1?.session) return undefined;

         if (!transport || transport === "cookie") {
            const cookies = request.headers.get("Cookie");
            if (cookies) {
               const cookie = getCookieValue(cookies, cookieKey);
               if (cookie) {
                  return cookie;
               }
            }
         }

         if (!transport || transport === "header") {
            if (request.headers.has(headerKey)) {
               return request.headers.get(headerKey) as any;
            }
         }

         return undefined;
      },
      set: (c: Context, d1?: D1DatabaseSession) => {
         if (!d1 || !config.d1?.session) return;

         const session = d1.getBookmark();
         if (session) {
            if (!transport || transport === "header") {
               c.header(headerKey, session);
            }
            if (!transport || transport === "cookie") {
               setCookie(c, cookieKey, session, {
                  httpOnly: true,
                  secure: true,
                  sameSite: "Lax",
                  maxAge: 60 * 5, // 5 minutes
               });
            }
         }
      },
   };
}

let media_registered: boolean = false;
export function makeConfig<Env extends CloudflareEnv = CloudflareEnv>(
   config: CloudflareBkndConfig<Env>,
   args?: CfMakeConfigArgs<Env>,
) {
   if (!media_registered) {
      registerMedia(args?.env as any);
      media_registered = true;
   }

   const appConfig = makeAdapterConfig(config, args?.env);

   // if connection instance is given, don't do anything
   // other than checking if D1 session is defined
   if (D1Connection.isConnection(appConfig.connection)) {
      if (config.d1?.session) {
         // we cannot guarantee that db was opened with session
         throw new Error(
            "D1 session don't work when D1 is directly given as connection. Define it in bindings instead.",
         );
      }
      // if connection is given, try to open with unified sqlite adapter
   } else if (appConfig.connection) {
      appConfig.connection = sqlite(appConfig.connection);

      // if connection is not given, but env is set
      // try to make D1 from bindings
   } else if (args?.env) {
      const bindings = config.bindings?.(args?.env);
      const sessionHelper = d1SessionHelper(config);
      const sessionId = sessionHelper.get(args.request);
      let session: D1DatabaseSession | undefined;
      let db: D1Database | undefined;

      // if db is given in bindings, use it
      if (bindings?.db) {
         $console.log("Using database from bindings");
         db = bindings.db;

         // scan for D1Database in args
      } else {
         const binding = getBinding(args.env, "D1Database");
         if (binding) {
            $console.log(`Using database from env "${binding.key}"`);
            db = binding.value;
         }
      }

      // if db is found, check if session is requested
      if (db) {
         if (config.d1?.session) {
            session = db.withSession(sessionId ?? config.d1?.first);

            appConfig.connection = new D1Connection({ binding: session });
            appConfig.options = {
               ...appConfig.options,
               manager: {
                  ...appConfig.options?.manager,
                  onServerInit: (server) => {
                     server.use(async (c, next) => {
                        sessionHelper.set(c, session);
                        await next();
                     });
                  },
               },
            };
         } else {
            appConfig.connection = new D1Connection({ binding: db });
         }
      }
   }

   if (!D1Connection.isConnection(appConfig.connection)) {
      throw new Error("Couldn't find database connection");
   }

   return appConfig;
}

export function registerAsyncsExecutionContext(
   app: App,
   ctx: { waitUntil: ExecutionContext["waitUntil"] },
) {
   app.emgr.onEvent(
      App.Events.AppBeforeResponse,
      async (event) => {
         ctx.waitUntil(event.params.app.emgr.executeAsyncs());
      },
      {
         mode: "sync",
         id: constants.exec_async_event_id,
      },
   );
}
