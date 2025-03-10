import { Exception } from "core";
import { type Static, StringEnum, Type } from "core/utils";
import { cors } from "hono/cors";
import { Module } from "modules/Module";

const serverMethods = ["GET", "POST", "PATCH", "PUT", "DELETE"];
const appThemes = ["dark", "light", "system"] as const;
export type AppTheme = (typeof appThemes)[number];

export const serverConfigSchema = Type.Object(
   {
      admin: Type.Object(
         {
            basepath: Type.Optional(Type.String({ default: "", pattern: "^(/.+)?$" })),
            color_scheme: Type.Optional(StringEnum(["dark", "light", "system"])),
            logo_return_path: Type.Optional(
               Type.String({
                  default: "/",
                  description: "Path to return to after *clicking* the logo",
               }),
            ),
         },
         { default: {}, additionalProperties: false },
      ),
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

/*declare global {
   interface Request {
      cf: IncomingRequestCfProperties;
   }
}*/

export class AppServer extends Module<typeof serverConfigSchema> {
   //private admin_html?: string;

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
         console.error(err);

         if (err instanceof Response) {
            return err;
         }

         if (err instanceof Exception) {
            console.log("---is exception", err.code);
            return c.json(err.toJSON(), err.code as any);
         }

         return c.json({ error: err.message }, 500);
      });
      this.setBuilt();
   }

   override toJSON(secrets?: boolean) {
      return this.config;
   }
}
