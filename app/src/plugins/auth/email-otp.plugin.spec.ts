import { afterAll, beforeAll, describe, expect, mock, test, setSystemTime } from "bun:test";
import { emailOTP } from "./email-otp.plugin";
import { createApp } from "core/test/utils";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

describe("otp plugin", () => {
   test("should not work if auth is not enabled", async () => {
      const app = createApp({
         options: {
            plugins: [emailOTP({ showActualErrors: true })],
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

   test("should require email driver if sendEmail is true", async () => {
      const app = createApp({
         config: {
            auth: {
               enabled: true,
            },
         },
         options: {
            plugins: [emailOTP()],
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

      {
         const app = createApp({
            config: {
               auth: {
                  enabled: true,
               },
            },
            options: {
               plugins: [emailOTP({ sendEmail: false })],
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
         expect(res.status).toBe(201);
      }
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
            plugins: [emailOTP({ showActualErrors: true })],
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
            plugins: [emailOTP({ showActualErrors: true })],
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
      expect(data.sent).toBe(true);
      expect(data.data.email).toBe("test@test.com");
      expect(data.data.action).toBe("login");
      expect(data.data.expires_at).toBeDefined();

      {
         const { data } = await app.em.fork().repo("users_otp").findOne({ email: "test@test.com" });
         expect(data?.code).toBeDefined();
         expect(data?.code?.length).toBe(6);
         expect(data?.code?.split("").every((char: string) => Number.isInteger(Number(char)))).toBe(
            true,
         );
         expect(data?.email).toBe("test@test.com");
      }
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
               emailOTP({
                  showActualErrors: true,
                  generateEmail: (otp) => ({ subject: "test", body: otp.code }),
               }),
            ],
            drivers: {
               email: {
                  send: async (to, _subject, body) => {
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
               emailOTP({
                  showActualErrors: true,
                  generateEmail: (otp) => ({ subject: "test", body: otp.code }),
               }),
            ],
            drivers: {
               email: {
                  send: async (to, _subject, body) => {
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
      const data = (await res.json()) as any;
      expect(data.sent).toBe(true);
      expect(data.data.email).toBe("test@test.com");
      expect(data.data.action).toBe("register");
      expect(data.data.expires_at).toBeDefined();

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

   test("should not send email if sendEmail is false", async () => {
      const called = mock(() => null);
      const app = createApp({
         config: {
            auth: {
               enabled: true,
            },
         },
         options: {
            plugins: [emailOTP({ sendEmail: false })],
            drivers: {
               email: {
                  send: async () => {
                     called();
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
      expect(res.status).toBe(201);
      expect(called).not.toHaveBeenCalled();
   });

   test("should reject invalid codes", async () => {
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
               emailOTP({
                  showActualErrors: true,
                  generateEmail: (otp) => ({ subject: "test", body: otp.code }),
               }),
            ],
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

      // First send a code
      await app.server.request("/api/auth/otp/login", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ email: "test@test.com" }),
      });

      // Try to use an invalid code
      const res = await app.server.request("/api/auth/otp/login", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ email: "test@test.com", code: "999999" }),
      });
      expect(res.status).toBe(400);
      const error = await res.json();
      expect(error).toBeDefined();
   });

   test("should reject code reuse", async () => {
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
               emailOTP({
                  showActualErrors: true,
                  generateEmail: (otp) => ({ subject: "test", body: otp.code }),
               }),
            ],
            drivers: {
               email: {
                  send: async (_to, _subject, body) => {
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

      // Send a code
      await app.server.request("/api/auth/otp/login", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ email: "test@test.com" }),
      });

      // Use the code successfully
      {
         const res = await app.server.request("/api/auth/otp/login", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: "test@test.com", code }),
         });
         expect(res.status).toBe(200);
      }

      // Try to use the same code again
      {
         const res = await app.server.request("/api/auth/otp/login", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: "test@test.com", code }),
         });
         expect(res.status).toBe(400);
         const error = await res.json();
         expect(error).toBeDefined();
      }
   });

   test("should reject expired codes", async () => {
      // Set a fixed system time
      const baseTime = Date.now();
      setSystemTime(new Date(baseTime));

      try {
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
                  emailOTP({
                     showActualErrors: true,
                     ttl: 1, // 1 second TTL
                     generateEmail: (otp) => ({ subject: "test", body: otp.code }),
                  }),
               ],
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

         // Send a code
         const sendRes = await app.server.request("/api/auth/otp/login", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: "test@test.com" }),
         });
         expect(sendRes.status).toBe(201);

         // Get the code from the database
         const { data: otpData } = await app.em
            .fork()
            .repo("users_otp")
            .findOne({ email: "test@test.com" });
         expect(otpData?.code).toBeDefined();

         // Advance system time by more than 1 second to expire the code
         setSystemTime(new Date(baseTime + 1100));

         // Try to use the expired code
         const res = await app.server.request("/api/auth/otp/login", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: "test@test.com", code: otpData?.code }),
         });
         expect(res.status).toBe(400);
         const error = await res.json();
         expect(error).toBeDefined();
      } finally {
         // Reset system time
         setSystemTime();
      }
   });

   test("should reject codes with different actions", async () => {
      let loginCode = "";
      let registerCode = "";

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
               emailOTP({
                  showActualErrors: true,
                  generateEmail: (otp) => ({ subject: "test", body: otp.code }),
               }),
            ],
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

      // Send a login code
      await app.server.request("/api/auth/otp/login", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ email: "test@test.com" }),
      });

      // Get the login code
      const { data: loginOtp } = await app
         .getApi()
         .data.readOneBy("users_otp", { where: { email: "test@test.com", action: "login" } });
      loginCode = loginOtp?.code || "";

      // Send a register code
      await app.server.request("/api/auth/otp/register", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ email: "test@test.com" }),
      });

      // Get the register code
      const { data: registerOtp } = await app
         .getApi()
         .data.readOneBy("users_otp", { where: { email: "test@test.com", action: "register" } });
      registerCode = registerOtp?.code || "";

      // Try to use login code for register
      {
         const res = await app.server.request("/api/auth/otp/register", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: "test@test.com", code: loginCode }),
         });
         expect(res.status).toBe(400);
         const error = await res.json();
         expect(error).toBeDefined();
      }

      // Try to use register code for login
      {
         const res = await app.server.request("/api/auth/otp/login", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: "test@test.com", code: registerCode }),
         });
         expect(res.status).toBe(400);
         const error = await res.json();
         expect(error).toBeDefined();
      }
   });

   test("should invalidate previous codes when sending new code", async () => {
      let firstCode = "";
      let secondCode = "";

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
               emailOTP({
                  showActualErrors: true,
                  generateEmail: (otp) => ({ subject: "test", body: otp.code }),
               }),
            ],
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
      const em = app.em.fork();

      // Send first code
      await app.server.request("/api/auth/otp/login", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ email: "test@test.com" }),
      });

      // Get the first code
      const { data: firstOtp } = await em
         .repo("users_otp")
         .findOne({ email: "test@test.com", action: "login" });
      firstCode = firstOtp?.code || "";
      expect(firstCode).toBeDefined();

      // Send second code (should invalidate the first)
      await app.server.request("/api/auth/otp/login", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ email: "test@test.com" }),
      });

      // Get the second code
      const { data: secondOtp } = await em
         .repo("users_otp")
         .findOne({ email: "test@test.com", action: "login" });
      secondCode = secondOtp?.code || "";
      expect(secondCode).toBeDefined();
      expect(secondCode).not.toBe(firstCode);

      // Try to use the first code (should fail as it's been invalidated)
      {
         const res = await app.server.request("/api/auth/otp/login", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: "test@test.com", code: firstCode }),
         });
         expect(res.status).toBe(400);
         const error = await res.json();
         expect(error).toBeDefined();
      }

      // The second code should work
      {
         const res = await app.server.request("/api/auth/otp/login", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: "test@test.com", code: secondCode }),
         });
         expect(res.status).toBe(200);
      }
   });
});
