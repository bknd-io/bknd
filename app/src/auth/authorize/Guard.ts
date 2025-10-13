import { Exception } from "core/errors";
import { $console, type s } from "bknd/utils";
import type { Permission, PermissionContext } from "auth/authorize/Permission";
import type { Context } from "hono";
import type { ServerEnv } from "modules/Controller";
import type { Role } from "./Role";
import { HttpStatus } from "bknd/utils";
import type { Policy, PolicySchema } from "./Policy";

export type GuardUserContext = {
   role?: string | null;
   [key: string]: any;
};

export type GuardConfig = {
   enabled?: boolean;
   context?: object;
};
export type GuardContext = Context<ServerEnv> | GuardUserContext;

export class GuardPermissionsException extends Exception {
   override name = "PermissionsException";
   override code = HttpStatus.FORBIDDEN;

   constructor(
      public permission: Permission,
      public policy?: Policy,
      public description?: string,
   ) {
      super(`Permission "${permission.name}" not granted`);
   }

   override toJSON(): any {
      return {
         ...super.toJSON(),
         description: this.description,
         permission: this.permission.name,
         policy: this.policy?.toJSON(),
      };
   }
}

export class Guard {
   constructor(
      public permissions: Permission<any, any, any, any>[] = [],
      public roles: Role[] = [],
      public config?: GuardConfig,
   ) {
      this.permissions = permissions;
      this.roles = roles;
      this.config = config;
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

   registerPermission(permission: Permission<any, any, any, any>) {
      if (this.permissions.find((p) => p.name === permission.name)) {
         throw new Error(`Permission ${permission.name} already exists`);
      }

      this.permissions.push(permission);
      return this;
   }

   registerPermissions(permissions: Record<string, Permission<any, any, any, any>>);
   registerPermissions(permissions: Permission<any, any, any, any>[]);
   registerPermissions(
      permissions:
         | Permission<any, any, any, any>[]
         | Record<string, Permission<any, any, any, any>>,
   ) {
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

   private collect(permission: Permission, c: GuardContext, context: any) {
      const user = c && "get" in c ? c.get("auth")?.user : c;
      const ctx = {
         ...((context ?? {}) as any),
         ...this.config?.context,
         user,
      };
      const exists = this.permissionExists(permission.name);
      const role = this.getUserRole(user);
      const rolePermission = role?.permissions.find(
         (rolePermission) => rolePermission.permission.name === permission.name,
      );
      return {
         ctx,
         user,
         exists,
         role,
         rolePermission,
      };
   }

   granted<P extends Permission<any, any, any, any>>(
      permission: P,
      c: GuardContext,
      context: PermissionContext<P>,
   ): void;
   granted<P extends Permission<any, any, undefined, any>>(permission: P, c: GuardContext): void;
   granted<P extends Permission<any, any, any, any>>(
      permission: P,
      c: GuardContext,
      context?: PermissionContext<P>,
   ): void {
      if (!this.isEnabled()) {
         return;
      }
      const { ctx, user, exists, role, rolePermission } = this.collect(permission, c, context);

      $console.debug("guard: checking permission", {
         name: permission.name,
         context: ctx,
      });
      if (!exists) {
         throw new GuardPermissionsException(
            permission,
            undefined,
            `Permission ${permission.name} does not exist`,
         );
      }

      if (!role) {
         $console.debug("guard: user has no role, denying");
         throw new GuardPermissionsException(permission, undefined, "User has no role");
      } else if (role.implicit_allow === true) {
         $console.debug(`guard: role "${role.name}" has implicit allow, allowing`);
         return;
      }

      if (!rolePermission) {
         $console.debug("guard: rolePermission not found, denying");
         throw new GuardPermissionsException(
            permission,
            undefined,
            "Role does not have required permission",
         );
      }

      // validate context
      let ctx2 = Object.assign({}, ctx);
      if (permission.context) {
         ctx2 = permission.parseContext(ctx2);
      }

      if (rolePermission?.policies.length > 0) {
         $console.debug("guard: rolePermission has policies, checking");
         for (const policy of rolePermission.policies) {
            // skip filter policies
            if (policy.content.effect === "filter") continue;

            // if condition unmet or effect is deny, throw
            const meets = policy.meetsCondition(ctx2);
            if (!meets || (meets && policy.content.effect === "deny")) {
               throw new GuardPermissionsException(
                  permission,
                  policy,
                  "Policy does not meet condition",
               );
            }
         }
      }

      $console.debug("guard allowing", {
         permission: permission.name,
         role: role.name,
      });
   }

   getPolicyFilter<P extends Permission<any, any, any, any>>(
      permission: P,
      c: GuardContext,
      context: PermissionContext<P>,
   ): PolicySchema["filter"] | undefined;
   getPolicyFilter<P extends Permission<any, any, undefined, any>>(
      permission: P,
      c: GuardContext,
   ): PolicySchema["filter"] | undefined;
   getPolicyFilter<P extends Permission<any, any, any, any>>(
      permission: P,
      c: GuardContext,
      context?: PermissionContext<P>,
   ): PolicySchema["filter"] | undefined {
      if (!permission.isFilterable()) return;

      const { ctx, exists, role, rolePermission } = this.collect(permission, c, context);

      // validate context
      let ctx2 = Object.assign({}, ctx);
      if (permission.context) {
         ctx2 = permission.parseContext(ctx2);
      }

      if (exists && role && rolePermission && rolePermission.policies.length > 0) {
         for (const policy of rolePermission.policies) {
            if (policy.content.effect === "filter") {
               return policy.meetsFilter(ctx2) ? policy.content.filter : undefined;
            }
         }
      }
      return;
   }
}
