import { describe, it, expect } from "bun:test";
import * as sDirect from "jsonv-ts";
import { s as sFromBknd } from "bknd/utils";

describe("jsonv-ts resolution", () => {
   it("should resolve to a single instance", () => {
      const sameNamespace = sDirect === (sFromBknd as unknown as typeof sDirect);
      // If this fails, two instances are being loaded via different specifiers/paths
      expect(sameNamespace).toBe(true);
   });

   it("should resolve specifiers to a single package path", async () => {
      const base = await import.meta.resolve("jsonv-ts");
      const hono = await import.meta.resolve("jsonv-ts/hono");
      const mcp = await import.meta.resolve("jsonv-ts/mcp");
      expect(typeof base).toBe("string");
      expect(typeof hono).toBe("string");
      expect(typeof mcp).toBe("string");
      // They can be different files (subpath exports), but they should share the same package root
      const pkgRoot = (p: string) => p.slice(0, p.lastIndexOf("jsonv-ts") + "jsonv-ts".length);
      expect(pkgRoot(base)).toBe(pkgRoot(hono));
      expect(pkgRoot(base)).toBe(pkgRoot(mcp));
   });
});
