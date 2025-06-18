import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { createApp } from "core/test/utils";
import { AuthController } from "../../src/auth/api/AuthController";
import { em, entity, make, text } from "../../src/data";
import { AppAuth, type ModuleBuildContext } from "../../src/modules";
import { disableConsoleLog, enableConsoleLog } from "../helper";
// @ts-ignore
import { makeCtx, moduleTestSuite } from "./module-test-suite";

describe("AppAuth", () => {
   moduleTestSuite(AppAuth);

   let ctx: ModuleBuildContext;

   beforeEach(() => {
      ctx = makeCtx();
   });

   test("secrets", async () => {
      // auth must be enabled, otherwise default config is returned
      const auth = new AppAuth({ enabled: true }, ctx);
      await auth.build();

      const config = auth.toJSON();
      expect(config.jwt).toBeUndefined();
      expect(config.strategies?.password?.config).toBeUndefined();
   });

   test("enabling auth: generate secret", async () => {
      const auth = new AppAuth(undefined, ctx);
      await auth.build();

      const oldConfig = auth.toJSON(true);
      //console.log(oldConfig);
      await auth.schema().patch("enabled", true);
      await auth.build();
      const newConfig = auth.toJSON(true);
      //console.log(newConfig);
      expect(newConfig.jwt.secret).not.toBe(oldConfig.jwt.secret);
   });

   test("creates user on register", async () => {
      const auth = new AppAuth(
         {
            enabled: true,
            // @ts-ignore
            jwt: {
               secret: "123456",
            },
         },
         ctx,
      );

      await auth.build();
      await ctx.em.schema().sync({ force: true });

      // expect no users, but the query to pass
      const res = await ctx.em.repository("users").findMany();
      expect(res.data.length).toBe(0);

      const app = new AuthController(auth).getController();

      {
         disableConsoleLog();
         const res = await app.request("/password/register", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({
               email: "some@body.com",
               password: "12345678",
            }),
         });
         enableConsoleLog();
         expect(res.status).toBe(200);

         const { data: users } = await ctx.em.repository("users").findMany();
         expect(users.length).toBe(1);
         expect(users[0]?.email).toBe("some@body.com");
      }
   });

   test("creates user on register (bcrypt)", async () => {
      const auth = new AppAuth(
         {
            enabled: true,
            strategies: {
               password: {
                  type: "password",
                  config: {
                     hashing: "bcrypt",
                  },
               },
            },
            // @ts-ignore
            jwt: {
               secret: "123456",
            },
         },
         ctx,
      );

      await auth.build();
      await ctx.em.schema().sync({ force: true });

      // expect no users, but the query to pass
      const res = await ctx.em.repository("users").findMany();
      expect(res.data.length).toBe(0);

      const app = new AuthController(auth).getController();

      {
         disableConsoleLog();
         const res = await app.request("/password/register", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({
               email: "some@body.com",
               password: "12345678",
            }),
         });
         enableConsoleLog();
         expect(res.status).toBe(200);

         const { data: users } = await ctx.em.repository("users").findMany();
         expect(users.length).toBe(1);
         expect(users[0]?.email).toBe("some@body.com");
      }

      {
         // check user in database
         const rawUser = await ctx.connection.kysely
            .selectFrom("users")
            .selectAll()
            .executeTakeFirstOrThrow();
         expect(rawUser.strategy_value).toStartWith("$");
      }
   });

   test("registers auth middleware for bknd routes only", async () => {
      const app = createApp({
         initialConfig: {
            auth: {
               enabled: true,
               jwt: {
                  secret: "123456",
               },
            },
         },
      });

      await app.build();
      app.registerAdminController();
      const spy = spyOn(app.module.auth.authenticator, "requestCookieRefresh");

      // register custom route
      app.server.get("/test", async (c) => c.text("test"));

      // call a system api and then the custom route
      await app.server.request("/api/system/ping");
      await app.server.request("/test");

      expect(spy.mock.calls.length).toBe(0);

      // admin route
      await app.server.request("/");
      expect(spy.mock.calls.length).toBe(1);
   });

   test("should allow additional user fields", async () => {
      const app = createApp({
         initialConfig: {
            auth: {
               entity_name: "users",
               enabled: true,
            },
            data: em({
               users: entity("users", {
                  additional: text(),
               }),
            }).toJSON(),
         },
      });

      await app.build();

      const e = app.modules.em.entity("users");
      const fields = e.fields.map((f) => f.name);
      expect(e.type).toBe("system");
      expect(fields).toContain("additional");
      expect(fields).toEqual(["id", "additional", "email", "strategy", "strategy_value", "role"]);
   });

   test("ensure user field configs is always correct", async () => {
      const app = createApp({
         initialConfig: {
            auth: {
               enabled: true,
            },
            data: em({
               users: entity("users", {
                  strategy: text({
                     fillable: true,
                     hidden: false,
                  }),
                  strategy_value: text({
                     fillable: true,
                     hidden: false,
                  }),
               }),
            }).toJSON(),
         },
      });
      await app.build();

      const users = app.em.entity("users");
      const props = ["hidden", "fillable", "required"];

      for (const [name, _authFieldProto] of Object.entries(AppAuth.usersFields)) {
         const authField = make(name, _authFieldProto as any);
         const field = users.field(name)!;
         for (const prop of props) {
            expect(field.config[prop]).toEqual(authField.config[prop]);
         }
      }
   });
});
