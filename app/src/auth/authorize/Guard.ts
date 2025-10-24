import { Exception } from "core/errors";
import { $console, mergeObject, type s } from "bknd/utils";
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

   private collect(permission: Permission, c: GuardContext | undefined, context: any) {
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
      const { ctx: _ctx, exists, role, rolePermission } = this.collect(permission, c, context);

      // validate context
      let ctx = Object.assign({}, _ctx);
      if (permission.context) {
         ctx = permission.parseContext(ctx);
      }

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
         throw new GuardPermissionsException(permission, undefined, "User has no role");
      }

      if (!rolePermission) {
         if (role.implicit_allow === true) {
            $console.debug(`guard: role "${role.name}" has implicit allow, allowing`);
            return;
         }

         throw new GuardPermissionsException(
            permission,
            undefined,
            `Role "${role.name}" does not have required permission`,
         );
      }

      if (rolePermission?.policies.length > 0) {
         $console.debug("guard: rolePermission has policies, checking");

         // set the default effect of the role permission
         let allowed = rolePermission.effect === "allow";
         for (const policy of rolePermission.policies) {
            // skip filter policies
            if (policy.content.effect === "filter") continue;

            // if condition is met, check the effect
            const meets = policy.meetsCondition(ctx);
            if (meets) {
               // if deny, then break early
               if (policy.content.effect === "deny") {
                  allowed = false;
                  break;

                  // if allow, set allow but continue checking
               } else if (policy.content.effect === "allow") {
                  allowed = true;
               }
            }
         }

         if (!allowed) {
            throw new GuardPermissionsException(permission, undefined, "Policy condition unmet");
         }
      }

      $console.debug("guard allowing", {
         permission: permission.name,
         role: role.name,
      });
   }

   filters<P extends Permission<any, any, any, any>>(
      permission: P,
      c: GuardContext,
      context: PermissionContext<P>,
   );
   filters<P extends Permission<any, any, undefined, any>>(permission: P, c: GuardContext);
   filters<P extends Permission<any, any, any, any>>(
      permission: P,
      c: GuardContext,
      context?: PermissionContext<P>,
   ) {
      if (!permission.isFilterable()) {
         throw new GuardPermissionsException(permission, undefined, "Permission is not filterable");
      }

      const {
         ctx: _ctx,
         exists,
         role,
         user,
         rolePermission,
      } = this.collect(permission, c, context);

      // validate context
      let ctx = Object.assign(
         {
            user,
         },
         _ctx,
      );

      if (permission.context) {
         ctx = permission.parseContext(ctx, {
            coerceDropUnknown: false,
         });
      }

      const filters: PolicySchema["filter"][] = [];
      const policies: Policy[] = [];
      if (exists && role && rolePermission && rolePermission.policies.length > 0) {
         for (const policy of rolePermission.policies) {
            if (policy.content.effect === "filter") {
               const meets = policy.meetsCondition(ctx);
               if (meets) {
                  policies.push(policy);
                  filters.push(policy.getReplacedFilter(ctx));
               }
            }
         }
      }

      const filter = filters.length > 0 ? mergeObject({}, ...filters) : undefined;
      return {
         filters,
         filter,
         policies,
         merge: (givenFilter: object | undefined) => {
            return mergeObject(givenFilter ?? {}, filter ?? {});
         },
         matches: (subject: object | object[], opts?: { throwOnError?: boolean }) => {
            const subjects = Array.isArray(subject) ? subject : [subject];
            if (policies.length > 0) {
               for (const policy of policies) {
                  for (const subject of subjects) {
                     if (!policy.meetsFilter(subject, ctx)) {
                        if (opts?.throwOnError) {
                           throw new GuardPermissionsException(
                              permission,
                              policy,
                              "Policy filter not met",
                           );
                        }
                        return false;
                     }
                  }
               }
            }
            return true;
         },
      };
   }
}
