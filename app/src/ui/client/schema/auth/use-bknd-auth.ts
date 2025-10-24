import type { AppAuthSchema } from "auth/auth-schema";
import { useBknd } from "ui/client/bknd";
import { routes } from "ui/lib/routes";

export function useBkndAuth() {
   const { config, schema, actions: bkndActions, app } = useBknd();

   const actions = {
      config: {
         set: async (data: Partial<AppAuthSchema>) => {
            console.log("--set", data);
            if (await bkndActions.set("auth", data, true)) {
               await bkndActions.reload();
               return true;
            }
            return false;
         },
      },
      roles: {
         add: async (name: string, data: any = {}) => {
            console.log("add role", name, data);
            return await bkndActions.add("auth", `roles.${name}`, data);
         },
         patch: async (name: string, data: any) => {
            console.log("patch role", name, data);
            return await bkndActions.patch("auth", `roles.${name}`, data);
         },
         delete: async (name: string) => {
            console.log("delete role", name);
            if (window.confirm(`Are you sure you want to delete the role "${name}"?`)) {
               return await bkndActions.remove("auth", `roles.${name}`);
            }
            return false;
         },
      },
   };

   const minimum_permissions = [
      "system.access.admin",
      "system.access.api",
      "system.config.read",
      "system.config.read.secrets",
      "system.build",
   ];
   const $auth = {
      roles: {
         none: Object.keys(config.auth.roles ?? {}).length === 0,
         minimum_permissions,
         has_admin: Object.entries(config.auth.roles ?? {}).some(
            ([name, role]) =>
               role.implicit_allow ||
               minimum_permissions.every((p) => role.permissions?.some((p) => p.permission === p)),
         ),
      },
      routes: {
         settings: app.getSettingsPath(["auth"]),
         listUsers: app.getAbsolutePath(
            "/data/" + routes.data.entity.list(config.auth.entity_name),
         ),
      },
   };

   return {
      $auth,
      config: config.auth,
      schema: schema.auth,
      actions,
   };
}
