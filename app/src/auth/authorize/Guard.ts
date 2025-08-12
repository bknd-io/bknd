import { Exception } from "core/errors";
import { $console, objectTransform } from "bknd/utils";
import { Permission } from "core/security/Permission";
import type { Context } from "hono";
import type { ServerEnv } from "modules/Controller";
import { Role } from "./Role";

export type GuardUserContext = {
   role?: string | null;
   [key: string]: any;
};

export type GuardConfig = {
   enabled?: boolean;
};
export type GuardContext = Context<ServerEnv> | GuardUserContext;

export class Guard {
   permissions: Permission[];
   roles?: Role[];
   config?: GuardConfig;

   constructor(permissions: Permission[] = [], roles: Role[] = [], config?: GuardConfig) {
      this.permissions = permissions;
      this.roles = roles;
      this.config = config;
   }

   static create(
      permissionNames: string[],
      roles?: Record<
         string,
         {
            permissions?: string[];
            is_default?: boolean;
            implicit_allow?: boolean;
         }
      >,
      config?: GuardConfig,
   ) {
      const _roles = roles
         ? objectTransform(roles, ({ permissions = [], is_default, implicit_allow }, name) => {
              return Role.createWithPermissionNames(name, permissions, is_default, implicit_allow);
           })
         : {};
      const _permissions = permissionNames.map((name) => new Permission(name));
      return new Guard(_permissions, Object.values(_roles), config);
   }

   getPermissionNames(): string[] {
      return this.permissions.map((permission) => permission.name);
   }

   getPermissions(): Permission[] {
      return this.permissions;
   }

   permissionExists(permissionName: string): boolean {
      return !!this.permissions.find((p) => p.name === permissionName);
   }

   setRoles(roles: Role[]) {
      this.roles = roles;
      return this;
   }

   getRoles() {
      return this.roles;
   }

   setConfig(config: Partial<GuardConfig>) {
      this.config = { ...this.config, ...config };
      return this;
   }

   registerPermission(permission: Permission) {
      if (this.permissions.find((p) => p.name === permission.name)) {
         throw new Error(`Permission ${permission.name} already exists`);
      }

      this.permissions.push(permission);
      return this;
   }

   registerPermissions(permissions: Record<string, Permission>);
   registerPermissions(permissions: Permission[]);
   registerPermissions(permissions: Permission[] | Record<string, Permission>) {
      const p = Array.isArray(permissions) ? permissions : Object.values(permissions);

      for (const permission of p) {
         this.registerPermission(permission);
      }

      return this;
   }

   getUserRole(user?: GuardUserContext): Role | undefined {
      if (user && typeof user.role === "string") {
         const role = this.roles?.find((role) => role.name === user?.role);
         if (role) {
            $console.debug(`guard: role "${user.role}" found`);
            return role;
         }
      }

      $console.debug("guard: role not found", {
         user,
      });
      return this.getDefaultRole();
   }

   getDefaultRole(): Role | undefined {
      return this.roles?.find((role) => role.is_default);
   }

   isEnabled() {
      return this.config?.enabled === true;
   }

   hasPermission(permission: Permission, user?: GuardUserContext): boolean;
   hasPermission(name: string, user?: GuardUserContext): boolean;
   hasPermission(permissionOrName: Permission | string, user?: GuardUserContext): boolean {
      if (!this.isEnabled()) {
         return true;
      }

      const name = typeof permissionOrName === "string" ? permissionOrName : permissionOrName.name;
      $console.debug("guard: checking permission", {
         name,
         user: { id: user?.id, role: user?.role },
      });
      const exists = this.permissionExists(name);
      if (!exists) {
         throw new Error(`Permission ${name} does not exist`);
      }

      const role = this.getUserRole(user);

      if (!role) {
         $console.debug("guard: user has no role, denying");
         return false;
      } else if (role.implicit_allow === true) {
         $console.debug(`guard: role "${role.name}" has implicit allow, allowing`);
         return true;
      }

      const rolePermission = role.permissions.find(
         (rolePermission) => rolePermission.permission.name === name,
      );

      $console.debug("guard: rolePermission, allowing?", {
         permission: name,
         role: role.name,
         allowing: !!rolePermission,
      });
      return !!rolePermission;
   }

   granted(permission: Permission | string, c?: GuardContext): boolean {
      const user = c && "get" in c ? c.get("auth")?.user : c;
      return this.hasPermission(permission as any, user);
   }

   throwUnlessGranted(permission: Permission | string, c: GuardContext) {
      if (!this.granted(permission, c)) {
         throw new Exception(
            `Permission "${typeof permission === "string" ? permission : permission.name}" not granted`,
            403,
         );
      }
   }
}
