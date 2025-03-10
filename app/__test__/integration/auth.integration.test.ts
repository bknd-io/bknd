import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { App, createApp } from "../../src";
import type { AuthResponse } from "../../src/auth";
import { auth } from "../../src/auth/middlewares";
import { randomString, secureRandomString, withDisabledConsole } from "../../src/core/utils";
import { disableConsoleLog, enableConsoleLog, getDummyConnection } from "../helper";

const { dummyConnection, afterAllCleanup } = getDummyConnection();
afterEach(afterAllCleanup);

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

const roles = {
   sloppy: {
      guest: {
         permissions: [
            "system.access.admin",
            "system.schema.read",
            "system.access.api",
            "system.config.read",
            "data.entity.read",
         ],
         is_default: true,
      },
      admin: {
         is_default: true,
         implicit_allow: true,
      },
   },
   strict: {
      guest: {
         permissions: ["system.access.api", "system.config.read", "data.entity.read"],
         is_default: true,
      },
      admin: {
         is_default: true,
         implicit_allow: true,
      },
   },
};
const configs = {
   auth: {
      enabled: true,
      entity_name: "users",
      jwt: {
         secret: secureRandomString(20),
         issuer: randomString(10),
      },
      roles: roles.strict,
      guard: {
         enabled: true,
      },
   },
   users: {
      normal: {
         email: "normal@bknd.io",
         password: "12345678",
      },
      admin: {
         email: "admin@bknd.io",
         password: "12345678",
         role: "admin",
      },
   },
};

function createAuthApp() {
   const app = createApp({
      connection: dummyConnection,
      initialConfig: {
         auth: configs.auth,
      },
   });

   app.emgr.onEvent(
      App.Events.AppFirstBoot,
      async () => {
         await app.createUser(configs.users.normal);
         await app.createUser(configs.users.admin);
      },
      "sync",
   );

   return app;
}

function getCookie(r: Response, name: string) {
   const cookies = r.headers.get("cookie") ?? r.headers.get("set-cookie");
   if (!cookies) return;
   const cookie = cookies.split(";").find((c) => c.trim().startsWith(name));
   if (!cookie) return;
   return cookie.split("=")[1];
}

const fns = <Mode extends "cookie" | "token" = "token">(app: App, mode?: Mode) => {
   function headers(token?: string, additional?: Record<string, string>) {
      if (mode === "cookie") {
         return {
            cookie: `auth=${token};`,
            ...additional,
         };
      }

      return {
         Authorization: token ? `Bearer ${token}` : "",
         "Content-Type": "application/json",
         ...additional,
      };
   }
   function body(obj?: Record<string, any>) {
      if (mode === "cookie") {
         const formData = new FormData();
         for (const key in obj) {
            formData.append(key, obj[key]);
         }
         return formData;
      }

      return JSON.stringify(obj);
   }

   return {
      login: async (
         user: any,
      ): Promise<{ res: Response; data: Mode extends "token" ? AuthResponse : string }> => {
         const res = (await app.server.request("/api/auth/password/login", {
            method: "POST",
            headers: headers(),
            body: body(user),
         })) as Response;

         const data = mode === "cookie" ? getCookie(res, "auth") : await res.json();

         return { res, data };
      },
      me: async (token?: string): Promise<Pick<AuthResponse, "user">> => {
         const res = (await app.server.request("/api/auth/me", {
            method: "GET",
            headers: headers(token),
         })) as Response;
         return await res.json();
      },
   };
};

describe("integration auth", () => {
   it("should create users on boot", async () => {
      const app = createAuthApp();
      await app.build();

      const { data: users } = await app.em.repository("users").findMany();
      expect(users.length).toBe(2);
      expect(users[0].email).toBe(configs.users.normal.email);
      expect(users[1].email).toBe(configs.users.admin.email);
   });

   it("should log you in with API", async () => {
      const app = createAuthApp();
      await app.build();
      const $fns = fns(app);

      // login api
      const { data } = await $fns.login(configs.users.normal);
      const me = await $fns.me(data.token);

      expect(data.user.email).toBe(me.user.email);
      expect(me.user.email).toBe(configs.users.normal.email);

      // expect no user with no token
      expect(await $fns.me()).toEqual({ user: null as any });

      // expect no user with invalid token
      expect(await $fns.me("invalid")).toEqual({ user: null as any });
      expect(await $fns.me()).toEqual({ user: null as any });
   });

   it("should log you in with form and cookie", async () => {
      const app = createAuthApp();
      await app.build();
      const $fns = fns(app, "cookie");

      const { res, data: token } = await $fns.login(configs.users.normal);
      expect(token).toBeDefined();
      expect(res.status).toBe(302); // because it redirects

      // test cookie jwt interchangability
      {
         // expect token to not work as-is for api endpoints
         expect(await fns(app).me(token)).toEqual({ user: null as any });
         // hono adds an additional segment to cookies
         const apified_token = token.split(".").slice(0, -1).join(".");
         // now it should work
         // @todo: maybe add a config to don't allow re-use?
         expect((await fns(app).me(apified_token)).user.email).toBe(configs.users.normal.email);
      }

      // test cookie with me endpoint
      {
         const me = await $fns.me(token);
         expect(me.user.email).toBe(configs.users.normal.email);

         // check with invalid & empty
         expect(await $fns.me("invalid")).toEqual({ user: null as any });
         expect(await $fns.me()).toEqual({ user: null as any });
      }
   });

   it("should check for permissions", async () => {
      const app = createAuthApp();
      await app.build();

      await withDisabledConsole(async () => {
         const res = await app.server.request("/api/system/schema");
         expect(res.status).toBe(403);
      });
   });

   it("context is exclusive", async () => {
      const app = createAuthApp();
      await app.build();
      const $fns = fns(app);

      app.server.get("/get", auth(), async (c) => {
         return c.json({
            user: c.get("auth").user ?? null,
         });
      });
      app.server.get("/wait", auth(), async (c) => {
         await new Promise((r) => setTimeout(r, 20));
         return c.json({ ok: true });
      });

      const { data } = await $fns.login(configs.users.normal);
      const me = await $fns.me(data.token);
      expect(me.user.email).toBe(configs.users.normal.email);

      app.server.request("/wait", {
         headers: { Authorization: `Bearer ${data.token}` },
      });

      {
         await new Promise((r) => setTimeout(r, 10));
         const res = await app.server.request("/get");
         const data = await res.json();
         expect(data.user).toBe(null);
         expect(await $fns.me()).toEqual({ user: null as any });
      }
   });
});
