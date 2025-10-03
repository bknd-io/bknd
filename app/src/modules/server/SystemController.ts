/// <reference types="@cloudflare/workers-types" />

import type { App } from "App";
import {
   datetimeStringLocal,
   datetimeStringUTC,
   getTimezone,
   getTimezoneOffset,
   $console,
   getRuntimeKey,
   jsc,
   s,
   describeRoute,
   InvalidSchemaError,
   openAPISpecs,
   mcpTool,
   mcp as mcpMiddleware,
   isNode,
   type McpServer,
} from "bknd/utils";
import type { Context, Hono } from "hono";
import { Controller } from "modules/Controller";
import { swaggerUI } from "@hono/swagger-ui";
import {
   MODULE_NAMES,
   type ModuleConfigs,
   type ModuleSchemas,
   type ModuleKey,
} from "modules/ModuleManager";
import * as SystemPermissions from "modules/permissions";
import { getVersion } from "core/env";
import type { Module } from "modules/Module";
import { getSystemMcp } from "modules/mcp/system-mcp";
import type { DbModuleManager } from "modules/db/DbModuleManager";

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
   readonly: boolean;
   config: ModuleConfigs;
   permissions: string[];
};

export class SystemController extends Controller {
   _mcpServer: McpServer | null = null;

   constructor(private readonly app: App) {
      super();
   }

   get ctx() {
      return this.app.modules.ctx();
   }

   register(app: App) {
      app.server.route("/api/system", this.getController());
      const config = app.modules.get("server").config;

      if (!config.mcp.enabled) {
         return;
      }

      this.registerMcp();

      app.server.use(
         mcpMiddleware({
            setup: async () => {
               if (!this._mcpServer) {
                  this._mcpServer = getSystemMcp(app);
                  this._mcpServer.onNotification((message) => {
                     if (message.method === "notification/message") {
                        const consoleMap = {
                           emergency: "error",
                           alert: "error",
                           critical: "error",
                           error: "error",
                           warning: "warn",
                           notice: "log",
                           info: "info",
                           debug: "debug",
                        };

                        const level = consoleMap[message.params.level];
                        if (!level) return;

                        $console[level](
                           "MCP notification",
                           message.params.message ?? message.params,
                        );
                     }
                  });
               }
               return {
                  server: this._mcpServer,
               };
            },
            sessionsEnabled: true,
            debug: {
               logLevel: config.mcp.logLevel as any,
               explainEndpoint: true,
            },
            endpoint: {
               path: config.mcp.path as any,
               // @ts-ignore
               _init: isNode() ? { duplex: "half" } : {},
            },
         }),
      );
   }

   private registerConfigController(client: Hono<any>): void {
      const { permission } = this.middlewares;
      // don't add auth again, it's already added in getController
      const hono = this.create().use(permission(SystemPermissions.configRead));

      if (!this.app.isReadOnly()) {
         const manager = this.app.modules as DbModuleManager;

         hono.get(
            "/raw",
            describeRoute({
               summary: "Get the raw config",
               tags: ["system"],
            }),
            permission(SystemPermissions.configReadSecrets),
            async (c) => {
               // @ts-expect-error "fetch" is private
               return c.json(await this.app.modules.fetch().then((r) => r?.configs));
            },
         );

         async function handleConfigUpdateResponse(
            c: Context<any>,
            cb: () => Promise<ConfigUpdate>,
         ) {
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
                  return c.json(
                     { success: false, type: "error", error: e.message },
                     { status: 500 },
                  );
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
                     await manager.mutateConfigSafe(module).set(newConfig);
                  } else {
                     await manager.mutateConfigSafe(module).patch("", value);
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
               return c.json(
                  { success: false, path, error: "Path already exists" },
                  { status: 400 },
               );
            }

            return await handleConfigUpdateResponse(c, async () => {
               await manager.mutateConfigSafe(module).patch(path, value);
               return {
                  success: true,
                  module,
                  config: this.app.module[module].config,
               };
            });
         });

         hono.patch(
            "/patch/:module/:path",
            permission(SystemPermissions.configWrite),
            async (c) => {
               // @todo: require auth (admin)
               const module = c.req.param("module") as any;
               const value = await c.req.json();
               const path = c.req.param("path");

               return await handleConfigUpdateResponse(c, async () => {
                  await manager.mutateConfigSafe(module).patch(path, value);
                  return {
                     success: true,
                     module,
                     config: this.app.module[module].config,
                  };
               });
            },
         );

         hono.put(
            "/overwrite/:module/:path",
            permission(SystemPermissions.configWrite),
            async (c) => {
               // @todo: require auth (admin)
               const module = c.req.param("module") as any;
               const value = await c.req.json();
               const path = c.req.param("path");

               return await handleConfigUpdateResponse(c, async () => {
                  await manager.mutateConfigSafe(module).overwrite(path, value);
                  return {
                     success: true,
                     module,
                     config: this.app.module[module].config,
                  };
               });
            },
         );

         hono.delete(
            "/remove/:module/:path",
            permission(SystemPermissions.configWrite),
            async (c) => {
               // @todo: require auth (admin)
               const module = c.req.param("module") as any;
               const path = c.req.param("path")!;

               return await handleConfigUpdateResponse(c, async () => {
                  await manager.mutateConfigSafe(module).remove(path);
                  return {
                     success: true,
                     module,
                     config: this.app.module[module].config,
                  };
               });
            },
         );
      }

      hono.get(
         "/:module?",
         describeRoute({
            summary: "Get the config for a module",
            tags: ["system"],
         }),
         mcpTool("system_config", {
            annotations: {
               readOnlyHint: true,
            },
         }), // @todo: ":module" gets not removed
         jsc("param", s.object({ module: s.string({ enum: MODULE_NAMES }).optional() })),
         jsc("query", s.object({ secrets: s.boolean().optional() })),
         async (c) => {
            // @todo: allow secrets if authenticated user is admin
            const { secrets } = c.req.valid("query");
            const { module } = c.req.valid("param");

            if (secrets) {
               this.ctx.guard.throwUnlessGranted(SystemPermissions.configReadSecrets, c, {
                  module,
               });
            }

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
            const readonly = this.app.isReadOnly();

            if (config) {
               this.ctx.guard.throwUnlessGranted(SystemPermissions.configRead, c, {
                  module,
               });
            }
            if (secrets) {
               this.ctx.guard.throwUnlessGranted(SystemPermissions.configReadSecrets, c, {
                  module,
               });
            }

            const { version, ...schema } = this.app.getSchema();

            if (fresh) {
               // in cases of concurrency, refetching schema/config must be always fresh
               await this.app.build({ fetch: true });
            }

            if (module) {
               return c.json({
                  module,
                  readonly,
                  version,
                  schema: schema[module],
                  config: config ? this.app.module[module].toJSON(secrets) : undefined,
               });
            }

            return c.json({
               module,
               version,
               readonly,
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
         mcpTool("system_build"),
         jsc("query", s.object({ sync: s.boolean().optional(), fetch: s.boolean().optional() })),
         async (c) => {
            const options = c.req.valid("query") as Record<string, boolean>;
            this.ctx.guard.throwUnlessGranted(SystemPermissions.build, c, {});

            await this.app.build(options);
            return c.json({
               success: true,
               options,
            });
         },
      );

      hono.get(
         "/ping",
         mcpTool("system_ping"),
         describeRoute({
            summary: "Ping the server",
            tags: ["system"],
         }),
         (c) => c.json({ pong: true }),
      );

      hono.get(
         "/info",
         mcpTool("system_info"),
         describeRoute({
            summary: "Get the server info",
            tags: ["system"],
         }),
         (c) =>
            c.json({
               id: this.app._id,
               version: {
                  config: c.get("app")?.version(),
                  bknd: getVersion(),
               },
               mode: this.app.mode,
               readonly: this.app.isReadOnly(),
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

   override registerMcp() {
      const { mcp } = this.app.modules.ctx();
      const { version, ...appConfig } = this.app.toJSON();

      mcp.resource("system_config", "bknd://system/config", async (c) => {
         await c.context.ctx().helper.throwUnlessGranted(SystemPermissions.configRead, c);

         return c.json(this.app.toJSON(), {
            title: "System Config",
         });
      })
         .resource(
            "system_config_module",
            "bknd://system/config/{module}",
            async (c, { module }) => {
               await this.ctx.helper.throwUnlessGranted(SystemPermissions.configRead, c);

               const m = this.app.modules.get(module as any) as Module;
               return c.json(m.toJSON(), {
                  title: `Config for ${module}`,
               });
            },
            {
               list: Object.keys(appConfig),
            },
         )
         .resource("system_schema", "bknd://system/schema", async (c) => {
            await this.ctx.helper.throwUnlessGranted(SystemPermissions.schemaRead, c);

            return c.json(this.app.getSchema(), {
               title: "System Schema",
            });
         })
         .resource(
            "system_schema_module",
            "bknd://system/schema/{module}",
            async (c, { module }) => {
               await this.ctx.helper.throwUnlessGranted(SystemPermissions.schemaRead, c);

               const m = this.app.modules.get(module as any);
               return c.json(m.getSchema().toJSON(), {
                  title: `Schema for ${module}`,
               });
            },
            {
               list: Object.keys(this.app.getSchema()),
            },
         );
   }
}
