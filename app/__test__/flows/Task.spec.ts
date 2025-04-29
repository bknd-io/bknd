import { describe, expect, test } from "bun:test";
import { Type } from "@sinclair/typebox";
import { Task } from "../../src/flows";
import { dynamic } from "../../src/flows/tasks/Task";

describe("Task", async () => {
   test("resolveParams: template with parse", async () => {
      const result = await Task.resolveParams(
         Type.Object({ test: dynamic(Type.Number()) }),
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
         Type.Object({ test: Type.String() }),
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
         Type.Object({ test: dynamic(Type.Object({ key: Type.String(), value: Type.String() })) }),
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
