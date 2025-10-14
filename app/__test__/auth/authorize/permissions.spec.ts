import { describe, it, expect } from "bun:test";
import { s } from "bknd/utils";
import { Permission } from "auth/authorize/Permission";
import { Policy } from "auth/authorize/Policy";
import { Hono } from "hono";
import { getPermissionRoutes, permission } from "auth/middlewares/permission.middleware";
import { auth } from "auth/middlewares/auth.middleware";
import { Guard, type GuardConfig } from "auth/authorize/Guard";
import { Role, RolePermission } from "auth/authorize/Role";
import { Exception } from "bknd";

describe("Permission", () => {
   it("works with minimal schema", () => {
      expect(() => new Permission("test")).not.toThrow();
   });

   it("parses context", () => {
      const p = new Permission(
         "test3",
         {
            filterable: true,
         },
         s.object({
            a: s.string(),
         }),
      );

      // @ts-expect-error
      expect(() => p.parseContext({ a: [] })).toThrow();
      expect(p.parseContext({ a: "test" })).toEqual({ a: "test" });
      // @ts-expect-error
      expect(p.parseContext({ a: 1 })).toEqual({ a: "1" });
   });
});

describe("Policy", () => {
   it("works with minimal schema", () => {
      expect(() => new Policy().toJSON()).not.toThrow();
   });

   it("checks condition", () => {
      const p = new Policy({
         condition: {
            a: 1,
         },
      });

      expect(p.meetsCondition({ a: 1 })).toBe(true);
      expect(p.meetsCondition({ a: 2 })).toBe(false);
      expect(p.meetsCondition({ a: 1, b: 1 })).toBe(true);
      expect(p.meetsCondition({})).toBe(false);

      const p2 = new Policy({
         condition: {
            a: { $gt: 1 },
            $or: {
               b: { $lt: 2 },
            },
         },
      });

      expect(p2.meetsCondition({ a: 2 })).toBe(true);
      expect(p2.meetsCondition({ a: 1 })).toBe(false);
      expect(p2.meetsCondition({ a: 1, b: 1 })).toBe(true);
   });

   it("filters", () => {
      const p = new Policy({
         filter: {
            age: { $gt: 18 },
         },
      });
      const subjects = [{ age: 19 }, { age: 17 }, { age: 12 }];

      expect(p.getFiltered(subjects)).toEqual([{ age: 19 }]);

      expect(p.meetsFilter({ age: 19 })).toBe(true);
      expect(p.meetsFilter({ age: 17 })).toBe(false);
      expect(p.meetsFilter({ age: 12 })).toBe(false);
   });

   it("replaces placeholders", () => {
      const p = new Policy({
         condition: {
            a: "@auth.username",
         },
         filter: {
            a: "@auth.username",
         },
      });
      const vars = { auth: { username: "test" } };

      expect(p.meetsCondition({ a: "test" }, vars)).toBe(true);
      expect(p.meetsCondition({ a: "test2" }, vars)).toBe(false);
      expect(p.meetsCondition({ a: "test2" })).toBe(false);
      expect(p.meetsFilter({ a: "test" }, vars)).toBe(true);
      expect(p.meetsFilter({ a: "test2" }, vars)).toBe(false);
      expect(p.meetsFilter({ a: "test2" })).toBe(false);
   });
});

describe("Guard", () => {
   it("collects filters", () => {
      const p = new Permission(
         "test",
         {
            filterable: true,
         },
         s.object({
            a: s.number(),
         }),
      );
      const r = new Role("test", [
         new RolePermission(p, [
            new Policy({
               condition: { a: { $eq: 1 } },
               filter: { foo: "bar" },
               effect: "filter",
            }),
         ]),
      ]);
      const guard = new Guard([p], [r], {
         enabled: true,
      });
      expect(
         guard.getPolicyFilter(
            p,
            {
               role: r.name,
            },
            { a: 1 },
         ),
      ).toEqual({ foo: "bar" });
      expect(
         guard.getPolicyFilter(
            p,
            {
               role: r.name,
            },
            { a: 2 },
         ),
      ).toBeUndefined();
      // if no user context given, filter cannot be applied
      expect(guard.getPolicyFilter(p, {}, { a: 1 })).toBeUndefined();
   });

   it("collects filters for default role", () => {
      const p = new Permission(
         "test",
         {
            filterable: true,
         },
         s.object({
            a: s.number(),
         }),
      );
      const r = new Role(
         "test",
         [
            new RolePermission(p, [
               new Policy({
                  condition: { a: { $eq: 1 } },
                  filter: { foo: "bar" },
                  effect: "filter",
               }),
            ]),
         ],
         true,
      );
      const guard = new Guard([p], [r], {
         enabled: true,
      });

      expect(
         guard.getPolicyFilter(
            p,
            {
               role: r.name,
            },
            { a: 1 },
         ),
      ).toEqual({ foo: "bar" });
      expect(
         guard.getPolicyFilter(
            p,
            {
               role: r.name,
            },
            { a: 2 },
         ),
      ).toBeUndefined();
      // if no user context given, the default role is applied
      // hence it can be found
      expect(guard.getPolicyFilter(p, {}, { a: 1 })).toEqual({ foo: "bar" });
   });
});

describe("permission middleware", () => {
   const makeApp = (
      permissions: Permission<any, any, any, any>[],
      roles: Role[] = [],
      config: Partial<GuardConfig> = {},
   ) => {
      const app = {
         module: {
            auth: {
               enabled: true,
            },
         },
         modules: {
            ctx: () => ({
               guard: new Guard(permissions, roles, {
                  enabled: true,
                  ...config,
               }),
            }),
         },
      };
      return new Hono()
         .use(async (c, next) => {
            // @ts-expect-error
            c.set("app", app);
            await next();
         })
         .use(auth())
         .onError((err, c) => {
            if (err instanceof Exception) {
               return c.json(err.toJSON(), err.code as any);
            }
            return c.json({ error: err.message }, "code" in err ? (err.code as any) : 500);
         });
   };

   it("allows if guard is disabled", async () => {
      const p = new Permission("test");
      const hono = makeApp([p], [], { enabled: false }).get("/test", permission(p, {}), async (c) =>
         c.text("test"),
      );

      const res = await hono.request("/test");
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("test");
   });

   it("denies if guard is enabled", async () => {
      const p = new Permission("test");
      const hono = makeApp([p]).get("/test", permission(p, {}), async (c) => c.text("test"));

      const res = await hono.request("/test");
      expect(res.status).toBe(403);
   });

   it("allows if user has (plain) role", async () => {
      const p = new Permission("test");
      const r = Role.create("test", { permissions: [p.name] });
      const hono = makeApp([p], [r])
         .use(async (c, next) => {
            // @ts-expect-error
            c.set("auth", { registered: true, user: { id: 0, role: r.name } });
            await next();
         })
         .get("/test", permission(p, {}), async (c) => c.text("test"));

      const res = await hono.request("/test");
      expect(res.status).toBe(200);
   });

   it("allows if user has role with policy", async () => {
      const p = new Permission("test");
      const r = new Role("test", [
         new RolePermission(p, [
            new Policy({
               condition: {
                  a: { $gte: 1 },
               },
            }),
         ]),
      ]);
      const hono = makeApp([p], [r], {
         context: {
            a: 1,
         },
      })
         .use(async (c, next) => {
            // @ts-expect-error
            c.set("auth", { registered: true, user: { id: 0, role: r.name } });
            await next();
         })
         .get("/test", permission(p, {}), async (c) => c.text("test"));

      const res = await hono.request("/test");
      expect(res.status).toBe(200);
   });

   it("denies if user with role doesn't meet condition", async () => {
      const p = new Permission("test");
      const r = new Role("test", [
         new RolePermission(
            p,
            [
               new Policy({
                  condition: {
                     a: { $lt: 1 },
                  },
                  // default effect is allow
               }),
            ],
            // change default effect to deny if no condition is met
            "deny",
         ),
      ]);
      const hono = makeApp([p], [r], {
         context: {
            a: 1,
         },
      })
         .use(async (c, next) => {
            // @ts-expect-error
            c.set("auth", { registered: true, user: { id: 0, role: r.name } });
            await next();
         })
         .get("/test", permission(p, {}), async (c) => c.text("test"));

      const res = await hono.request("/test");
      expect(res.status).toBe(403);
   });

   it("allows if user with role doesn't meet condition (from middleware)", async () => {
      const p = new Permission(
         "test",
         {},
         s.object({
            a: s.number(),
         }),
      );
      const r = new Role("test", [
         new RolePermission(p, [
            new Policy({
               condition: {
                  a: { $eq: 1 },
               },
            }),
         ]),
      ]);
      const hono = makeApp([p], [r])
         .use(async (c, next) => {
            // @ts-expect-error
            c.set("auth", { registered: true, user: { id: 0, role: r.name } });
            await next();
         })
         .get(
            "/test",
            permission(p, {
               context: (c) => ({
                  a: 1,
               }),
            }),
            async (c) => c.text("test"),
         );

      const res = await hono.request("/test");
      expect(res.status).toBe(200);
   });

   it("throws if permission context is invalid", async () => {
      const p = new Permission(
         "test",
         {},
         s.object({
            a: s.number({ minimum: 2 }),
         }),
      );
      const r = new Role("test", [
         new RolePermission(p, [
            new Policy({
               condition: {
                  a: { $eq: 1 },
               },
            }),
         ]),
      ]);
      const hono = makeApp([p], [r])
         .use(async (c, next) => {
            // @ts-expect-error
            c.set("auth", { registered: true, user: { id: 0, role: r.name } });
            await next();
         })
         .get(
            "/test",
            permission(p, {
               context: (c) => ({
                  a: 1,
               }),
            }),
            async (c) => c.text("test"),
         );

      const res = await hono.request("/test");
      // expecting 500 because bknd should have handled it correctly
      expect(res.status).toBe(500);
   });

   it("checks context on routes with permissions", async () => {
      const make = (user: any) => {
         const p = new Permission(
            "test",
            {},
            s.object({
               a: s.number(),
            }),
         );
         const r = new Role("test", [
            new RolePermission(p, [
               new Policy({
                  condition: {
                     a: { $eq: 1 },
                  },
               }),
            ]),
         ]);
         return makeApp([p], [r])
            .use(async (c, next) => {
               // @ts-expect-error
               c.set("auth", { registered: true, user });
               await next();
            })
            .get(
               "/valid",
               permission(p, {
                  context: (c) => ({
                     a: 1,
                  }),
               }),
               async (c) => c.text("test"),
            )
            .get(
               "/invalid",
               permission(p, {
                  // @ts-expect-error
                  context: (c) => ({
                     b: "1",
                  }),
               }),
               async (c) => c.text("test"),
            )
            .get(
               "/invalid2",
               permission(p, {
                  // @ts-expect-error
                  context: (c) => ({}),
               }),
               async (c) => c.text("test"),
            )
            .get(
               "/invalid3",
               // @ts-expect-error
               permission(p),
               async (c) => c.text("test"),
            );
      };

      const hono = make({ id: 0, role: "test" });
      const valid = await hono.request("/valid");
      expect(valid.status).toBe(200);
      const invalid = await hono.request("/invalid");
      expect(invalid.status).toBe(500);
      const invalid2 = await hono.request("/invalid2");
      expect(invalid2.status).toBe(500);
      const invalid3 = await hono.request("/invalid3");
      expect(invalid3.status).toBe(500);

      {
         const hono = make(null);
         const valid = await hono.request("/valid");
         expect(valid.status).toBe(403);
         const invalid = await hono.request("/invalid");
         expect(invalid.status).toBe(500);
         const invalid2 = await hono.request("/invalid2");
         expect(invalid2.status).toBe(500);
         const invalid3 = await hono.request("/invalid3");
         expect(invalid3.status).toBe(500);
      }
   });
});

describe("Role", () => {
   it("serializes and deserializes", () => {
      const p = new Permission(
         "test",
         {
            filterable: true,
         },
         s.object({
            a: s.number({ minimum: 2 }),
         }),
      );
      const r = new Role(
         "test",
         [
            new RolePermission(p, [
               new Policy({
                  condition: {
                     a: { $eq: 1 },
                  },
                  effect: "deny",
                  filter: {
                     b: { $lt: 1 },
                  },
               }),
            ]),
         ],
         true,
      );
      const json = JSON.parse(JSON.stringify(r.toJSON()));
      const r2 = Role.create(p.name, json);
      expect(r2.toJSON()).toEqual(r.toJSON());
   });
});
