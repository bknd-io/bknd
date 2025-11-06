import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { otp } from "./otp.plugin";
import { createApp } from "core/test/utils";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

describe("otp plugin", () => {
   test("should not work if auth is not enabled", async () => {
      const app = createApp({
         options: {
            plugins: [otp({ showActualErrors: true })],
         },
      });
      await app.build();
      const res = await app.server.request("/api/auth/otp/login", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ email: "test@test.com" }),
      });
      expect(res.status).toBe(404);
   });

   test("should prevent mutations of the OTP entity", async () => {
      const app = createApp({
         config: {
            auth: {
               enabled: true,
            },
         },
         options: {
            drivers: {
               email: {
                  send: async () => {},
               },
            },
            plugins: [otp({ showActualErrors: true })],
         },
      });
      await app.build();

      const payload = {
         email: "test@test.com",
         code: "123456",
         action: "login",
         created_at: new Date(),
         expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24),
         used_at: null,
      };

      expect(app.em.mutator("users_otp").insertOne(payload)).rejects.toThrow();
      expect(
         await app
            .getApi()
            .data.createOne("users_otp", payload)
            .then((r) => r.ok),
      ).toBe(false);
   });

   test("should generate a token", async () => {
      const called = mock(() => null);
      const app = createApp({
         config: {
            auth: {
               enabled: true,
            },
         },
         options: {
            plugins: [otp({ showActualErrors: true })],
            drivers: {
               email: {
                  send: async (to) => {
                     expect(to).toBe("test@test.com");
                     called();
                  },
               },
            },
            seed: async (ctx) => {
               await ctx.app.createUser({ email: "test@test.com", password: "12345678" });
            },
         },
      });
      await app.build();

      const res = await app.server.request("/api/auth/otp/login", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ email: "test@test.com" }),
      });
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ sent: true, action: "login" } as any);

      const { data } = await app
         .getApi()
         .data.readOneBy("users_otp", { where: { email: "test@test.com" } });
      expect(data?.code).toBeDefined();
      expect(data?.code?.length).toBe(6);
      expect(data?.code?.split("").every((char: string) => Number.isInteger(Number(char)))).toBe(
         true,
      );
      expect(data?.email).toBe("test@test.com");
      expect(called).toHaveBeenCalled();
   });

   test("should login with a code", async () => {
      let code = "";

      const app = createApp({
         config: {
            auth: {
               enabled: true,
               jwt: {
                  secret: "test",
               },
            },
         },
         options: {
            plugins: [
               otp({
                  showActualErrors: true,
                  generateEmail: (otp) => ({ subject: "test", body: otp.code }),
               }),
            ],
            drivers: {
               email: {
                  send: async (to, subject, body) => {
                     expect(to).toBe("test@test.com");
                     code = String(body);
                  },
               },
            },
            seed: async (ctx) => {
               await ctx.app.createUser({ email: "test@test.com", password: "12345678" });
            },
         },
      });
      await app.build();

      await app.server.request("/api/auth/otp/login", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ email: "test@test.com" }),
      });

      {
         const res = await app.server.request("/api/auth/otp/login", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: "test@test.com", code }),
         });
         expect(res.status).toBe(200);
         expect(res.headers.get("set-cookie")).toBeDefined();
         const userData = (await res.json()) as any;
         expect(userData.user.email).toBe("test@test.com");
         expect(userData.token).toBeDefined();
      }
   });

   test("should register with a code", async () => {
      let code = "";

      const app = createApp({
         config: {
            auth: {
               enabled: true,
               jwt: {
                  secret: "test",
               },
            },
         },
         options: {
            plugins: [
               otp({
                  showActualErrors: true,
                  generateEmail: (otp) => ({ subject: "test", body: otp.code }),
               }),
            ],
            drivers: {
               email: {
                  send: async (to, subject, body) => {
                     expect(to).toBe("test@test.com");
                     code = String(body);
                  },
               },
            },
         },
      });
      await app.build();

      const res = await app.server.request("/api/auth/otp/register", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ email: "test@test.com" }),
      });
      expect(await res.json()).toEqual({ sent: true, action: "register" } as any);

      {
         const res = await app.server.request("/api/auth/otp/register", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: "test@test.com", code }),
         });
         expect(res.status).toBe(200);
         expect(res.headers.get("set-cookie")).toBeDefined();
         const userData = (await res.json()) as any;
         expect(userData.user.email).toBe("test@test.com");
         expect(userData.token).toBeDefined();
      }
   });

   // @todo: test invalid codes
   // @todo: test codes with different actions
   // @todo: test code expiration
});
