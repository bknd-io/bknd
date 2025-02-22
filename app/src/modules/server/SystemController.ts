/// <reference types="@cloudflare/workers-types" />

import type { App } from "App";
import { tbValidator as tb } from "core";
import {
   StringEnum,
   Type,
   TypeInvalidError,
   datetimeStringLocal,
   datetimeStringUTC,
   getTimezone,
   getTimezoneOffset
} from "core/utils";
import { getRuntimeKey } from "core/utils";
import type { Context, Hono } from "hono";
import { Controller } from "modules/Controller";

import {
   MODULE_NAMES,
   type ModuleConfigs,
   type ModuleKey,
   getDefaultConfig
} from "modules/ModuleManager";
import * as SystemPermissions from "modules/permissions";
import { generateOpenAPI } from "modules/server/openapi";

const booleanLike = Type.Transform(Type.String())
   .Decode((v) => v === "1")
   .Encode((v) => (v ? "1" : "0"));

export type ConfigUpdate<Key extends ModuleKey = ModuleKey> = {
   success: true;
   module: Key;
   config: ModuleConfigs[Key];
};
export type ConfigUpdateResponse<Key extends ModuleKey = ModuleKey> =
   | ConfigUpdate<Key>
   | { success: false; type: "type-invalid" | "error" | "unknown"; error?: any; errors?: any };

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

      hono.get("/raw", permission([SystemPermissions.configReadSecrets]), async (c) => {
         // @ts-expect-error "fetch" is private
         return c.json(await this.app.modules.fetch());
      });

      hono.get(
         "/:module?",
         tb("param", Type.Object({ module: Type.Optional(StringEnum(MODULE_NAMES)) })),
         tb(
            "query",
            Type.Object({
               secrets: Type.Optional(booleanLike)
            })
         ),
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
                       config: config[module]
                    }
                  : config
            );
         }
      );

      async function handleConfigUpdateResponse(c: Context<any>, cb: () => Promise<ConfigUpdate>) {
         try {
            return c.json(await cb(), { status: 202 });
         } catch (e) {
            console.error(e);

            if (e instanceof TypeInvalidError) {
               return c.json(
                  { success: false, type: "type-invalid", errors: e.errors },
                  { status: 400 }
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
         tb(
            "query",
            Type.Object({
               force: Type.Optional(booleanLike)
            })
         ),
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
                     ...value
                  };
                  await this.app.mutateConfig(module).set(newConfig);
               } else {
                  await this.app.mutateConfig(module).patch("", value);
               }
               return {
                  success: true,
                  module,
                  config: this.app.module[module].config
               };
            });
         }
      );

      hono.post("/add/:module/:path", permission(SystemPermissions.configWrite), async (c) => {
         // @todo: require auth (admin)
         const module = c.req.param("module") as any;
         const value = await c.req.json();
         const path = c.req.param("path") as string;

         if (this.app.modules.get(module).schema().has(path)) {
            return c.json({ success: false, path, error: "Path already exists" }, { status: 400 });
         }
         console.log("-- add", module, path, value);

         return await handleConfigUpdateResponse(c, async () => {
            await this.app.mutateConfig(module).patch(path, value);
            return {
               success: true,
               module,
               config: this.app.module[module].config
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
               config: this.app.module[module].config
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
               config: this.app.module[module].config
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
               config: this.app.module[module].config
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
         permission(SystemPermissions.schemaRead),
         tb(
            "query",
            Type.Object({
               config: Type.Optional(booleanLike),
               secrets: Type.Optional(booleanLike)
            })
         ),
         async (c) => {
            const module = c.req.param("module") as ModuleKey | undefined;
            const { config, secrets } = c.req.valid("query");

            config && this.ctx.guard.throwUnlessGranted(SystemPermissions.configRead, c);
            secrets && this.ctx.guard.throwUnlessGranted(SystemPermissions.configReadSecrets, c);

            const { version, ...schema } = this.app.getSchema();

            if (module) {
               return c.json({
                  module,
                  version,
                  schema: schema[module],
                  config: config ? this.app.module[module].toJSON(secrets) : undefined
               });
            }

            return c.json({
               module,
               version,
               schema,
               config: config ? this.app.toJSON(secrets) : undefined,
               permissions: this.app.modules.ctx().guard.getPermissionNames()
            });
         }
      );

      hono.post(
         "/build",
         tb(
            "query",
            Type.Object({
               sync: Type.Optional(booleanLike)
            })
         ),
         async (c) => {
            const { sync } = c.req.valid("query") as Record<string, boolean>;
            this.ctx.guard.throwUnlessGranted(SystemPermissions.build, c);

            await this.app.build({ sync });
            return c.json({ success: true, options: { sync } });
         }
      );

      hono.get("/ping", (c) => c.json({ pong: true }));

      hono.get("/info", (c) =>
         c.json({
            version: c.get("app")?.version(),
            runtime: getRuntimeKey(),
            timezone: {
               name: getTimezone(),
               offset: getTimezoneOffset(),
               local: datetimeStringLocal(),
               utc: datetimeStringUTC()
            }
         })
      );

      hono.get("/openapi.json", async (c) => {
         const config = getDefaultConfig();
         return c.json(generateOpenAPI(config));
      });

      return hono.all("*", (c) => c.notFound());
   }
}
