import { Exception } from "core/errors";
import { isDebug } from "core/env";
import { $console, s } from "bknd/utils";
import { $object } from "modules/mcp";
import { cors } from "hono/cors";
import { Module } from "modules/Module";
import { AuthException } from "auth/errors";

const serverMethods = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;

export const serverConfigSchema = $object(
   "config_server",
   {
      cors: s.strictObject({
         origin: s.string({ default: "*" }),
         allow_methods: s.array(s.string({ enum: serverMethods }), {
            default: serverMethods,
            uniqueItems: true,
         }),
         allow_headers: s.array(s.string(), {
            default: ["Content-Type", "Content-Length", "Authorization", "Accept"],
         }),
         allow_credentials: s.boolean({ default: true }),
      }),
      mcp: s.strictObject({
         enabled: s.boolean({ default: false }),
      }),
   },
   {
      description: "Server configuration",
   },
);

export type AppServerConfig = s.Static<typeof serverConfigSchema>;

export class AppServer extends Module<AppServerConfig> {
   override getRestrictedPaths() {
      return [];
   }

   get client() {
      return this.ctx.server;
   }

   getSchema() {
      return serverConfigSchema;
   }

   override async build() {
      const origin = this.config.cors.origin ?? "";
      this.client.use(
         "*",
         cors({
            origin: origin.includes(",") ? origin.split(",").map((o) => o.trim()) : origin,
            allowMethods: this.config.cors.allow_methods,
            allowHeaders: this.config.cors.allow_headers,
            credentials: this.config.cors.allow_credentials,
         }),
      );

      // add an initial fallback route
      this.client.use("/", async (c, next) => {
         await next();
         // if not finalized or giving a 404
         if (!c.finalized || c.res.status === 404) {
            // double check it's root
            if (new URL(c.req.url).pathname === "/") {
               c.res = undefined;
               c.res = Response.json({
                  bknd: "hello world!",
               });
            }
         }
      });

      this.client.onError((err, c) => {
         //throw err;
         $console.error("[AppServer:onError]", err);

         if (err instanceof Response) {
            return err;
         }

         if (err instanceof AuthException) {
            return c.json(err.toJSON(), err.getSafeErrorAndCode().code);
         }

         if (err instanceof Exception) {
            return c.json(err.toJSON(), err.code as any);
         }

         if (err instanceof Error) {
            if (isDebug()) {
               return c.json({ error: err.message, stack: err.stack }, 500);
            }
         }

         return c.json({ error: err.message }, 500);
      });
      this.setBuilt();
   }

   override toJSON(secrets?: boolean) {
      return this.config;
   }
}
