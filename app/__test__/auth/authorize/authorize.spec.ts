import { describe, expect, test } from "bun:test";
import { Guard, type GuardConfig } from "auth/authorize/Guard";
import { Permission } from "auth/authorize/Permission";
import { Role } from "auth/authorize/Role";
import { objectTransform } from "bknd/utils";

function createGuard(
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
           return Role.create({ name, permissions, is_default, implicit_allow });
        })
      : {};
   const _permissions = permissionNames.map((name) => new Permission(name));
   return new Guard(_permissions, Object.values(_roles), config);
}

describe("authorize", () => {
   const read = new Permission("read");
   const write = new Permission("write");

   test("basic", async () => {
      const guard = createGuard(
         ["read", "write"],
         {
            admin: {
               permissions: ["read", "write"],
            },
         },
         { enabled: true },
      );
      const user = {
         role: "admin",
      };

      expect(guard.granted(read, user)).toBeUndefined();
      expect(guard.granted(write, user)).toBeUndefined();

      expect(() => guard.granted(new Permission("something"), {})).toThrow();
   });

   test("with default", async () => {
      const guard = createGuard(
         ["read", "write"],
         {
            admin: {
               permissions: ["read", "write"],
            },
            guest: {
               permissions: ["read"],
               is_default: true,
            },
         },
         { enabled: true },
      );

      expect(guard.granted(read, {})).toBeUndefined();
      expect(() => guard.granted(write, {})).toThrow();

      const user = {
         role: "admin",
      };

      expect(guard.granted(read, user)).toBeUndefined();
      expect(guard.granted(write, user)).toBeUndefined();
   });

   test("guard implicit allow", async () => {
      const guard = createGuard([], {}, { enabled: false });

      expect(guard.granted(read, {})).toBeUndefined();
      expect(guard.granted(write, {})).toBeUndefined();
   });

   test("role implicit allow", async () => {
      const guard = createGuard(["read", "write"], {
         admin: {
            implicit_allow: true,
         },
      });

      const user = {
         role: "admin",
      };

      expect(guard.granted(read, user)).toBeUndefined();
      expect(guard.granted(write, user)).toBeUndefined();
   });

   test("guard with guest role implicit allow", async () => {
      const guard = createGuard(["read", "write"], {
         guest: {
            implicit_allow: true,
            is_default: true,
         },
      });

      expect(guard.getUserRole()?.name).toBe("guest");
      expect(guard.granted(read, {})).toBeUndefined();
      expect(guard.granted(write, {})).toBeUndefined();
   });
});
