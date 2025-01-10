import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { createApp } from "../../src";
import { AuthController } from "../../src/auth/api/AuthController";
import { em, entity, text } from "../../src/data";
import { AppAuth, type ModuleBuildContext } from "../../src/modules";
import { disableConsoleLog, enableConsoleLog } from "../helper";
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
      expect(config.strategies.password.config).toBeUndefined();
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
            jwt: {
               secret: "123456"
            }
         },
         ctx
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
               "Content-Type": "application/json"
            },
            body: JSON.stringify({
               email: "some@body.com",
               password: "123456"
            })
         });
         enableConsoleLog();
         expect(res.status).toBe(200);

         const { data: users } = await ctx.em.repository("users").findMany();
         expect(users.length).toBe(1);
         expect(users[0].email).toBe("some@body.com");
      }
   });

   test("registers auth middleware automatically", async () => {
      const app = createApp({
         initialConfig: {
            auth: {
               enabled: true,
               jwt: {
                  secret: "123456"
               }
            }
         }
      });

      await app.build();
      const spy = spyOn(app.module.auth.authenticator, "requestCookieRefresh");

      // register custom route
      app.server.get("/test", async (c) => c.text("test"));

      // call a system api and then the custom route
      await app.server.request("/api/system/ping");
      await app.server.request("/test");

      expect(spy.mock.calls.length).toBe(2);
   });

   test("should allow additional user fields", async () => {
      const app = createApp({
         initialConfig: {
            auth: {
               entity_name: "users",
               enabled: true
            },
            data: em({
               users: entity("users", {
                  additional: text()
               })
            }).toJSON()
         }
      });

      await app.build();

      const userfields = app.modules.em.entity("users").fields.map((f) => f.name);
      expect(userfields).toContain("additional");
      expect(userfields).toEqual([
         "id",
         "additional",
         "email",
         "strategy",
         "strategy_value",
         "role"
      ]);
   });
});
