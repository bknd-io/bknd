import { describe, expect, it } from "bun:test";
import { sign } from "hono/jwt";
import { Api } from "../../src/Api";

describe("Api", async () => {
   it("should construct without options", () => {
      const api = new Api();
      expect(api.baseUrl).toBe("http://localhost");

      // verified is true, because no token, user, headers or request given
      // therefore nothing to check, auth state is verified
      expect(api.isAuthVerified()).toBe(true);
   });

   it("should ignore force verify if no claims given", () => {
      const api = new Api({ verified: true });
      expect(api.baseUrl).toBe("http://localhost");
      expect(api.isAuthVerified()).toBe(true);
   });

   it("should construct from request (token)", async () => {
      const token = await sign({ foo: "bar" }, "1234");
      const request = new Request("http://example.com/test", {
         headers: {
            Authorization: `Bearer ${token}`,
         },
      });
      const api = new Api({ request });
      expect(api.isAuthVerified()).toBe(false);

      const params = api.getParams();
      expect(params.token).toBe(token);
      expect(params.token_transport).toBe("header");
      expect(params.host).toBe("http://example.com");
   });

   it("should construct from request (cookie)", async () => {
      const token = await sign({ foo: "bar" }, "1234");
      const request = new Request("http://example.com/test", {
         headers: {
            Cookie: `auth=${token}`,
         },
      });
      const api = new Api({ request });
      expect(api.isAuthVerified()).toBe(false);

      const params = api.getParams();
      expect(params.token).toBe(token);
      expect(params.token_transport).toBe("cookie");
      expect(params.host).toBe("http://example.com");
   });

   it("should construct from token", async () => {
      const token = await sign({ foo: "bar" }, "1234");
      const api = new Api({ token });
      expect(api.isAuthVerified()).toBe(false);

      const params = api.getParams();
      expect(params.token).toBe(token);
      expect(params.token_transport).toBe("header");
      expect(params.host).toBe("http://localhost");
   });

   it("should prefer host when request is given", async () => {
      const request = new Request("http://example.com/test");
      const api = new Api({ request, host: "http://another.com" });

      const params = api.getParams();
      expect(params.token).toBeUndefined();
      expect(params.token_transport).toBe("header");
      expect(params.host).toBe("http://another.com");
   });
});
