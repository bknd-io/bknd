import { describe, expect, test } from "bun:test";
import { Task } from "../../src/flows";
import { dynamic } from "../../src/flows/tasks/Task";
import { s } from "core/utils/schema";

describe.skip("Task", async () => {
   test("resolveParams: template with parse", async () => {
      const result = await Task.resolveParams(
         s.object({ test: dynamic(s.number()) }),
         {
            test: "{{ some.path }}",
         },
         {
            some: {
               path: 1,
            },
         },
      );

      expect(result.test).toBe(1);
   });

   test("resolveParams: with string", async () => {
      const result = await Task.resolveParams(
         s.object({ test: s.string() }),
         {
            test: "{{ some.path }}",
         },
         {
            some: {
               path: "1/1",
            },
         },
      );

      expect(result.test).toBe("1/1");
   });

   test("resolveParams: with object", async () => {
      const result = await Task.resolveParams(
         s.object({ test: dynamic(s.object({ key: s.string(), value: s.string() })) }),
         {
            test: { key: "path", value: "{{ some.path }}" },
         },
         {
            some: {
               path: "1/1",
            },
         },
      );

      expect(result.test).toEqual({ key: "path", value: "1/1" });
   });
});
