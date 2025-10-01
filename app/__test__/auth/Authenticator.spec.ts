import { Authenticator } from "auth/authenticate/Authenticator";
import { describe, expect, test } from "bun:test";

describe("Authenticator", async () => {
   test("should return auth cookie headers", async () => {
      const auth = new Authenticator({}, null as any, {
         jwt: {
            secret: "secret",
            fields: [],
         },
         cookie: {
            sameSite: "strict",
         },
      });
      const headers = await auth.getAuthCookieHeader("token");
      const cookie = headers.get("Set-Cookie");
      expect(cookie).toStartWith("auth=");
      expect(cookie).toEndWith("HttpOnly; Secure; SameSite=Strict");

      // now expect it to be removed
      const headers2 = await auth.removeAuthCookieHeader(headers);
      const cookie2 = headers2.get("Set-Cookie");
      expect(cookie2).toStartWith("auth=; Max-Age=0; Path=/; Expires=");
      expect(cookie2).toEndWith("HttpOnly; Secure; SameSite=Strict");
   });

   test("should return auth cookie string", async () => {
      const auth = new Authenticator({}, null as any, {
         jwt: {
            secret: "secret",
            fields: [],
         },
         cookie: {
            sameSite: "strict",
         },
      });
      const cookie = await auth.unsafeGetAuthCookie("token");
      expect(cookie).toStartWith("auth=");
      expect(cookie).toEndWith("HttpOnly; Secure; SameSite=Strict");
   });
});
