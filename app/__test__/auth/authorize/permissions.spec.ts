import { describe, it, expect } from "bun:test";
import { s } from "bknd/utils";
import { Permission, Policy } from "core/security/Permission";

describe("Permission", () => {
   it("works with minimal schema", () => {
      expect(() => new Permission("test")).not.toThrow();
   });

   it("parses context", () => {
      const p = new Permission(
         "test3",
         {
            filterable: true,
         },
         s.object({
            a: s.string(),
         }),
      );

      // @ts-expect-error
      expect(() => p.parseContext({ a: [] })).toThrow();
      expect(p.parseContext({ a: "test" })).toEqual({ a: "test" });
      // @ts-expect-error
      expect(p.parseContext({ a: 1 })).toEqual({ a: "1" });
   });
});

describe("Policy", () => {
   it("works with minimal schema", () => {
      expect(() => new Policy().toJSON()).not.toThrow();
   });

   it("checks condition", () => {
      const p = new Policy({
         condition: {
            a: 1,
         },
      });

      expect(p.meetsCondition({ a: 1 })).toBe(true);
      expect(p.meetsCondition({ a: 2 })).toBe(false);
      expect(p.meetsCondition({ a: 1, b: 1 })).toBe(true);
      expect(p.meetsCondition({})).toBe(false);

      const p2 = new Policy({
         condition: {
            a: { $gt: 1 },
            $or: {
               b: { $lt: 2 },
            },
         },
      });

      expect(p2.meetsCondition({ a: 2 })).toBe(true);
      expect(p2.meetsCondition({ a: 1 })).toBe(false);
      expect(p2.meetsCondition({ a: 1, b: 1 })).toBe(true);
   });

   it("filters", () => {
      const p = new Policy({
         filter: {
            age: { $gt: 18 },
         },
      });
      const subjects = [{ age: 19 }, { age: 17 }, { age: 12 }];

      expect(p.getFiltered(subjects)).toEqual([{ age: 19 }]);

      expect(p.meetsFilter({ age: 19 })).toBe(true);
      expect(p.meetsFilter({ age: 17 })).toBe(false);
      expect(p.meetsFilter({ age: 12 })).toBe(false);
   });

   it("replaces placeholders", () => {
      const p = new Policy({
         condition: {
            a: "@auth.username",
         },
         filter: {
            a: "@auth.username",
         },
      });
      const vars = { auth: { username: "test" } };

      expect(p.meetsCondition({ a: "test" }, vars)).toBe(true);
      expect(p.meetsCondition({ a: "test2" }, vars)).toBe(false);
      expect(p.meetsCondition({ a: "test2" })).toBe(false);
      expect(p.meetsFilter({ a: "test" }, vars)).toBe(true);
      expect(p.meetsFilter({ a: "test2" }, vars)).toBe(false);
      expect(p.meetsFilter({ a: "test2" })).toBe(false);
   });
});
