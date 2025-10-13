import { describe, expect, test } from "bun:test";
import { Guard, type GuardConfig } from "auth/authorize/Guard";
import { Permission } from "auth/authorize/Permission";
import { Role, type RoleSchema } from "auth/authorize/Role";
import { objectTransform, s } from "bknd/utils";

function createGuard(
   permissionNames: string[],
   roles?: Record<string, Omit<RoleSchema, "name">>,
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
   const read = new Permission("read", {
      filterable: true,
   });
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

   describe("cases", () => {
      test("guest none, member deny if user.enabled is false", () => {
         const guard = createGuard(
            ["read"],
            {
               guest: {
                  is_default: true,
               },
               member: {
                  permissions: [
                     {
                        permission: "read",
                        policies: [
                           {
                              condition: {},
                              effect: "filter",
                              filter: {
                                 type: "member",
                              },
                           },
                           {
                              condition: {
                                 "user.enabled": false,
                              },
                              effect: "deny",
                           },
                        ],
                     },
                  ],
               },
            },
            { enabled: true },
         );

         expect(() => guard.granted(read, { role: "guest" })).toThrow();

         // member is allowed, because default role permission effect is allow
         // and no deny policy is met
         expect(guard.granted(read, { role: "member" })).toBeUndefined();

         // member is allowed, because deny policy is not met
         expect(guard.granted(read, { role: "member", enabled: true })).toBeUndefined();

         // member is denied, because deny policy is met
         expect(() => guard.granted(read, { role: "member", enabled: false })).toThrow();

         // get the filter for member role
         expect(guard.getPolicyFilter(read, { role: "member" })).toEqual({
            type: "member",
         });

         // get filter for guest
         expect(guard.getPolicyFilter(read, {})).toBeUndefined();
      });

      test("guest should only read posts that are public", () => {
         const read = new Permission(
            "read",
            {
               // make this permission filterable
               // without this, `filter` policies have no effect
               filterable: true,
            },
            // expect the context to match this schema
            // otherwise exit with 500 to ensure proper policy checking
            s.object({
               entity: s.string(),
            }),
         );
         const guard = createGuard(
            ["read"],
            {
               guest: {
                  // this permission is applied if no (or invalid) role is provided
                  is_default: true,
                  permissions: [
                     {
                        permission: "read",
                        // effect deny means only having this permission, doesn't guarantee access
                        effect: "deny",
                        policies: [
                           {
                              // only if this condition is met
                              condition: {
                                 entity: {
                                    $in: ["posts"],
                                 },
                              },
                              // the effect is allow
                              effect: "allow",
                           },
                           {
                              condition: {
                                 entity: "posts",
                              },
                              effect: "filter",
                              filter: {
                                 public: true,
                              },
                           },
                        ],
                     },
                  ],
               },
               // members should be allowed to read all
               member: {
                  permissions: [
                     {
                        permission: "read",
                     },
                  ],
               },
            },
            { enabled: true },
         );

         // guest can only read posts
         expect(guard.granted(read, {}, { entity: "posts" })).toBeUndefined();
         expect(() => guard.granted(read, {}, { entity: "users" })).toThrow();

         // and guests can only read public posts
         expect(guard.getPolicyFilter(read, {}, { entity: "posts" })).toEqual({
            public: true,
         });

         // member can read posts and users
         expect(guard.granted(read, { role: "member" }, { entity: "posts" })).toBeUndefined();
         expect(guard.granted(read, { role: "member" }, { entity: "users" })).toBeUndefined();

         // member should not have a filter
         expect(
            guard.getPolicyFilter(read, { role: "member" }, { entity: "posts" }),
         ).toBeUndefined();
      });
   });
});
