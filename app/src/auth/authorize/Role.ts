import { s } from "bknd/utils";
import { Permission } from "./Permission";
import { Policy, policySchema } from "./Policy";

// default effect is allow for backward compatibility
const defaultEffect = "allow";

export const rolePermissionSchema = s.strictObject({
   permission: s.string(),
   effect: s.string({ enum: ["allow", "deny"], default: defaultEffect }).optional(),
   policies: s.array(policySchema).optional(),
});
export type RolePermissionSchema = s.Static<typeof rolePermissionSchema>;

export const roleSchema = s.strictObject({
   // @todo: remove anyOf, add migration
   permissions: s.anyOf([s.array(s.string()), s.array(rolePermissionSchema)]).optional(),
   is_default: s.boolean().optional(),
   implicit_allow: s.boolean().optional(),
});
export type RoleSchema = s.Static<typeof roleSchema>;

export class RolePermission {
   constructor(
      public permission: Permission<any, any, any, any>,
      public policies: Policy[] = [],
      public effect: "allow" | "deny" = defaultEffect,
   ) {}

   toJSON() {
      return {
         permission: this.permission.name,
         policies: this.policies.map((p) => p.toJSON()),
         effect: this.effect,
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

   static create(name: string, config: RoleSchema) {
      const permissions =
         config.permissions?.map((p: string | RolePermissionSchema) => {
            if (typeof p === "string") {
               return new RolePermission(new Permission(p), []);
            }
            const policies = p.policies?.map((policy) => new Policy(policy));
            return new RolePermission(new Permission(p.permission), policies, p.effect);
         }) ?? [];
      return new Role(name, permissions, config.is_default, config.implicit_allow);
   }

   toJSON() {
      return {
         permissions: this.permissions.map((p) => p.toJSON()),
         is_default: this.is_default,
         implicit_allow: this.implicit_allow,
      };
   }
}
