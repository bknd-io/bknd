import { Exception, isDebug } from "core";
import { type Static, StringEnum, $console } from "core/utils";
import { cors } from "hono/cors";
import { Module } from "modules/Module";
import * as tbbox from "@sinclair/typebox";
import { AuthException } from "auth/errors";
const { Type } = tbbox;

const serverMethods = ["GET", "POST", "PATCH", "PUT", "DELETE"];

export const serverConfigSchema = Type.Object(
   {
      cors: Type.Object(
         {
            origin: Type.String({ default: "*" }),
            allow_methods: Type.Array(StringEnum(serverMethods), {
               default: serverMethods,
               uniqueItems: true,
            }),
            allow_headers: Type.Array(Type.String(), {
               default: ["Content-Type", "Content-Length", "Authorization", "Accept"],
            }),
         },
         { default: {}, additionalProperties: false },
      ),
   },
   {
      additionalProperties: false,
   },
);

export type AppServerConfig = Static<typeof serverConfigSchema>;

export class AppServer extends Module<typeof serverConfigSchema> {
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
      this.client.use(
         "*",
         cors({
            origin: this.config.cors.origin,
            allowMethods: this.config.cors.allow_methods,
            allowHeaders: this.config.cors.allow_headers,
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
