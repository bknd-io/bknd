import { parse, s } from "bknd/utils";
import { Permission } from "./Permission";
import { Policy, policySchema } from "./Policy";

export const rolePermissionSchema = s.strictObject({
   permission: s.string(),
   policies: s.array(policySchema).optional(),
});
export type RolePermissionSchema = s.Static<typeof rolePermissionSchema>;

export const roleSchema = s.strictObject({
   name: s.string(),
   permissions: s.anyOf([s.array(s.string()), s.array(rolePermissionSchema)]).optional(),
   is_default: s.boolean().optional(),
   implicit_allow: s.boolean().optional(),
});
export type RoleSchema = s.Static<typeof roleSchema>;

export class RolePermission {
   constructor(
      public permission: Permission<any, any, any, any>,
      public policies: Policy[] = [],
   ) {}

   toJSON() {
      return {
         permission: this.permission.name,
         policies: this.policies.map((p) => p.toJSON()),
      };
   }
}

export class Role {
   constructor(
      public name: string,
      public permissions: RolePermission[] = [],
      public is_default: boolean = false,
      public implicit_allow: boolean = false,
   ) {}

   static create(config: RoleSchema) {
      const permissions =
         config.permissions?.map((p: string | RolePermissionSchema) => {
            if (typeof p === "string") {
               return new RolePermission(new Permission(p), []);
            }
            const policies = p.policies?.map((policy) => new Policy(policy));
            return new RolePermission(new Permission(p.permission), policies);
         }) ?? [];
      return new Role(config.name, permissions, config.is_default, config.implicit_allow);
   }

   toJSON() {
      return {
         name: this.name,
         permissions: this.permissions.map((p) => p.toJSON()),
         is_default: this.is_default,
         implicit_allow: this.implicit_allow,
      };
   }
}
