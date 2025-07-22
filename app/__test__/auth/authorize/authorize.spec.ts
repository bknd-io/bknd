import { describe, expect, test } from "bun:test";
import { Guard } from "../../../src/auth/authorize/Guard";

describe("authorize", () => {
   test("basic", async () => {
      const guard = Guard.create(
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

      expect(guard.granted("read", user)).toBe(true);
      expect(guard.granted("write", user)).toBe(true);

      expect(() => guard.granted("something")).toThrow();
   });

   test("with default", async () => {
      const guard = Guard.create(
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

      expect(guard.granted("read")).toBe(true);
      expect(guard.granted("write")).toBe(false);

      const user = {
         role: "admin",
      };

      expect(guard.granted("read", user)).toBe(true);
      expect(guard.granted("write", user)).toBe(true);
   });

   test("guard implicit allow", async () => {
      const guard = Guard.create([], {}, { enabled: false });

      expect(guard.granted("read")).toBe(true);
      expect(guard.granted("write")).toBe(true);
   });

   test("role implicit allow", async () => {
      const guard = Guard.create(["read", "write"], {
         admin: {
            implicit_allow: true,
         },
      });

      const user = {
         role: "admin",
      };

      expect(guard.granted("read", user)).toBe(true);
      expect(guard.granted("write", user)).toBe(true);
   });

   test("guard with guest role implicit allow", async () => {
      const guard = Guard.create(["read", "write"], {
         guest: {
            implicit_allow: true,
            is_default: true,
         },
      });

      expect(guard.getUserRole()?.name).toBe("guest");
      expect(guard.granted("read")).toBe(true);
      expect(guard.granted("write")).toBe(true);
   });
});
