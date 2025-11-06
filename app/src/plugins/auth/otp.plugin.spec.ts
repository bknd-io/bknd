import { describe, expect, mock, test } from "bun:test";
import { otp } from "./otp.plugin";
import { createApp } from "core/test/utils";

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
      const data = (await res.json()) as any;
      expect(data.data.code).toBeDefined();
      expect(data.data.code.length).toBe(6);
      expect(data.data.code.split("").every((char: string) => Number.isInteger(Number(char)))).toBe(
         true,
      );
      expect(data.data.email).toBe("test@test.com");
      expect(called).toHaveBeenCalled();
   });

   test("should login with a code", async () => {
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
            plugins: [otp({ showActualErrors: true })],
            drivers: {
               email: {
                  send: async () => {},
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
      const data = (await res.json()) as any;

      {
         const res = await app.server.request("/api/auth/otp/login", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: "test@test.com", code: data.data.code }),
         });
         expect(res.status).toBe(200);
         expect(res.headers.get("set-cookie")).toBeDefined();
         const userData = (await res.json()) as any;
         expect(userData.user.email).toBe("test@test.com");
         expect(userData.token).toBeDefined();
      }
   });

   test("should register with a code", async () => {
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
            plugins: [otp({ showActualErrors: true })],
            drivers: {
               email: {
                  send: async () => {},
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
      const data = (await res.json()) as any;

      {
         const res = await app.server.request("/api/auth/otp/register", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: "test@test.com", code: data.data.code }),
         });
         expect(res.status).toBe(200);
         expect(res.headers.get("set-cookie")).toBeDefined();
         const userData = (await res.json()) as any;
         expect(userData.user.email).toBe("test@test.com");
         expect(userData.token).toBeDefined();
      }
   });
});
