/// <reference types="@cloudflare/workers-types" />

import type { App } from "App";
import {
   datetimeStringLocal,
   datetimeStringUTC,
   getTimezone,
   getTimezoneOffset,
   $console,
   getRuntimeKey,
   SecretSchema,
   jsc,
   s,
   describeRoute,
   InvalidSchemaError,
} from "bknd/utils";
import type { Context, Hono } from "hono";
import { Controller } from "modules/Controller";
import { openAPISpecs } from "jsonv-ts/hono";
import { swaggerUI } from "@hono/swagger-ui";
import {
   MODULE_NAMES,
   type ModuleConfigs,
   type ModuleSchemas,
   type ModuleKey,
} from "modules/ModuleManager";
import * as SystemPermissions from "modules/permissions";
import { getVersion } from "core/env";

export type ConfigUpdate<Key extends ModuleKey = ModuleKey> = {
   success: true;
   module: Key;
   config: ModuleConfigs[Key];
};
export type ConfigUpdateResponse<Key extends ModuleKey = ModuleKey> =
   | ConfigUpdate<Key>
   | { success: false; type: "type-invalid" | "error" | "unknown"; error?: any; errors?: any };
export type SchemaResponse = {
   version: string;
   schema: ModuleSchemas;
   config: ModuleConfigs;
   permissions: string[];
};

export class SystemController extends Controller {
   constructor(private readonly app: App) {
      super();
   }

   get ctx() {
      return this.app.modules.ctx();
   }

   private registerConfigController(client: Hono<any>): void {
      const { permission } = this.middlewares;
      // don't add auth again, it's already added in getController
      const hono = this.create();

      hono.use(permission(SystemPermissions.configRead));

      hono.get(
         "/raw",
         describeRoute({
            summary: "Get the raw config",
            tags: ["system"],
         }),
         permission([SystemPermissions.configReadSecrets]),
         async (c) => {
            // @ts-expect-error "fetch" is private
            return c.json(await this.app.modules.fetch());
         },
      );

      hono.get(
         "/:module?",
         describeRoute({
            summary: "Get the config for a module",
            tags: ["system"],
         }),
         jsc("param", s.object({ module: s.string({ enum: MODULE_NAMES }).optional() })),
         jsc("query", s.object({ secrets: s.boolean().optional() })),
         async (c) => {
            // @todo: allow secrets if authenticated user is admin
            const { secrets } = c.req.valid("query");
            const { module } = c.req.valid("param");

            secrets && this.ctx.guard.throwUnlessGranted(SystemPermissions.configReadSecrets, c);

            const config = this.app.toJSON(secrets);

            return c.json(
               module
                  ? {
                       version: this.app.version(),
                       module,
                       config: config[module],
                    }
                  : config,
            );
         },
      );

      async function handleConfigUpdateResponse(c: Context<any>, cb: () => Promise<ConfigUpdate>) {
         try {
            return c.json(await cb(), { status: 202 });
         } catch (e) {
            $console.error("config update error", e);

            if (e instanceof InvalidSchemaError) {
               return c.json(
                  { success: false, type: "type-invalid", errors: e.errors },
                  { status: 400 },
               );
            }
            if (e instanceof Error) {
               return c.json({ success: false, type: "error", error: e.message }, { status: 500 });
            }

            return c.json({ success: false, type: "unknown" }, { status: 500 });
         }
      }

      hono.post(
         "/set/:module",
         permission(SystemPermissions.configWrite),
         jsc("query", s.object({ force: s.boolean().optional() }), { skipOpenAPI: true }),
         async (c) => {
            const module = c.req.param("module") as any;
            const { force } = c.req.valid("query");
            const value = await c.req.json();

            return await handleConfigUpdateResponse(c, async () => {
               // you must explicitly set force to override existing values
               // because omitted values gets removed
               if (force === true) {
                  // force overwrite defined keys
                  const newConfig = {
                     ...this.app.module[module].config,
                     ...value,
                  };
                  await this.app.mutateConfig(module).set(newConfig);
               } else {
                  await this.app.mutateConfig(module).patch("", value);
               }
               return {
                  success: true,
                  module,
                  config: this.app.module[module].config,
               };
            });
         },
      );

      hono.post("/add/:module/:path", permission(SystemPermissions.configWrite), async (c) => {
         // @todo: require auth (admin)
         const module = c.req.param("module") as any;
         const value = await c.req.json();
         const path = c.req.param("path") as string;

         if (this.app.modules.get(module).schema().has(path)) {
            return c.json({ success: false, path, error: "Path already exists" }, { status: 400 });
         }

         return await handleConfigUpdateResponse(c, async () => {
            await this.app.mutateConfig(module).patch(path, value);
            return {
               success: true,
               module,
               config: this.app.module[module].config,
            };
         });
      });

      hono.patch("/patch/:module/:path", permission(SystemPermissions.configWrite), async (c) => {
         // @todo: require auth (admin)
         const module = c.req.param("module") as any;
         const value = await c.req.json();
         const path = c.req.param("path");

         return await handleConfigUpdateResponse(c, async () => {
            await this.app.mutateConfig(module).patch(path, value);
            return {
               success: true,
               module,
               config: this.app.module[module].config,
            };
         });
      });

      hono.put("/overwrite/:module/:path", permission(SystemPermissions.configWrite), async (c) => {
         // @todo: require auth (admin)
         const module = c.req.param("module") as any;
         const value = await c.req.json();
         const path = c.req.param("path");

         return await handleConfigUpdateResponse(c, async () => {
            await this.app.mutateConfig(module).overwrite(path, value);
            return {
               success: true,
               module,
               config: this.app.module[module].config,
            };
         });
      });

      hono.delete("/remove/:module/:path", permission(SystemPermissions.configWrite), async (c) => {
         // @todo: require auth (admin)
         const module = c.req.param("module") as any;
         const path = c.req.param("path")!;

         return await handleConfigUpdateResponse(c, async () => {
            await this.app.mutateConfig(module).remove(path);
            return {
               success: true,
               module,
               config: this.app.module[module].config,
            };
         });
      });

      client.route("/config", hono);
   }

   override getController() {
      const { permission, auth } = this.middlewares;
      const hono = this.create().use(auth());

      this.registerConfigController(hono);

      hono.get(
         "/schema/:module?",
         describeRoute({
            summary: "Get the schema for a module",
            tags: ["system"],
         }),
         permission(SystemPermissions.schemaRead),
         jsc(
            "query",
            s
               .object({
                  config: s.boolean(),
                  secrets: s.boolean(),
                  fresh: s.boolean(),
               })
               .partial(),
         ),
         async (c) => {
            const module = c.req.param("module") as ModuleKey | undefined;
            const { config, secrets, fresh } = c.req.valid("query");

            config && this.ctx.guard.throwUnlessGranted(SystemPermissions.configRead, c);
            secrets && this.ctx.guard.throwUnlessGranted(SystemPermissions.configReadSecrets, c);

            const { version, ...schema } = this.app.getSchema();

            if (fresh) {
               // in cases of concurrency, refetching schema/config must be always fresh
               await this.app.build({ fetch: true });
            }

            if (module) {
               return c.json({
                  module,
                  version,
                  schema: schema[module],
                  config: config ? this.app.module[module].toJSON(secrets) : undefined,
               });
            }

            return c.json({
               module,
               version,
               schema,
               config: config ? this.app.toJSON(secrets) : undefined,
               permissions: this.app.modules.ctx().guard.getPermissionNames(),
            });
         },
      );

      hono.post(
         "/build",
         describeRoute({
            summary: "Build the app",
            tags: ["system"],
         }),
         jsc("query", s.object({ sync: s.boolean().optional(), fetch: s.boolean().optional() })),
         async (c) => {
            const options = c.req.valid("query") as Record<string, boolean>;
            this.ctx.guard.throwUnlessGranted(SystemPermissions.build, c);

            await this.app.build(options);
            return c.json({
               success: true,
               options,
            });
         },
      );

      hono.get(
         "/ping",
         describeRoute({
            summary: "Ping the server",
            tags: ["system"],
         }),
         (c) => c.json({ pong: true }),
      );

      hono.get(
         "/info",
         describeRoute({
            summary: "Get the server info",
            tags: ["system"],
         }),
         (c) =>
            c.json({
               version: c.get("app")?.version(),
               runtime: getRuntimeKey(),
               connection: {
                  name: this.app.em.connection.name,
                  // @ts-expect-error
                  supports: this.app.em.connection.supported,
               },
               timezone: {
                  name: getTimezone(),
                  offset: getTimezoneOffset(),
                  local: datetimeStringLocal(),
                  utc: datetimeStringUTC(),
               },
               origin: new URL(c.req.raw.url).origin,
               plugins: Array.from(this.app.plugins.keys()),
               walk: {
                  auth: [
                     ...c
                        .get("app")
                        .getSchema()
                        .auth.walk({ data: c.get("app").toJSON(true).auth }),
                  ]
                     .filter((n) => n.schema instanceof SecretSchema)
                     .map((n) => ({
                        ...n,
                        schema: n.schema.constructor.name,
                     })),
               },
            }),
      );

      hono.get(
         "/openapi.json",
         openAPISpecs(this.ctx.server, {
            info: {
               title: "bknd API",
               version: getVersion(),
            },
         }),
      );
      hono.get("/swagger", swaggerUI({ url: "/api/system/openapi.json" }));

      return hono;
   }
}
