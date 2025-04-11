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

   test("resolveParams: with json", async () => {
      const result = await Task.resolveParams(
         Type.Object({
            test: dynamic(Type.Object({ key: Type.String(), value: Type.String() })),
         }),
         {
            test: "{{ some | json }}",
         },
         {
            some: {
               key: "path",
               value: "1/1",
            },
         },
      );

      expect(result.test).toEqual({ key: "path", value: "1/1" });
   });

   test("resolveParams: with array", async () => {
      const result = await Task.resolveParams(
         Type.Object({
            test: dynamic(Type.Array(Type.String())),
         }),
         {
            test: '{{ "1,2,3" | split: "," | json }}',
         },
      );

      expect(result.test).toEqual(["1", "2", "3"]);
   });

   test("resolveParams: boolean", async () => {
      const result = await Task.resolveParams(
         Type.Object({
            test: dynamic(Type.Boolean()),
         }),
         {
            test: "{{ true }}",
         },
      );

      expect(result.test).toEqual(true);
   });

   test("resolveParams: float", async () => {
      const result = await Task.resolveParams(
         Type.Object({
            test: dynamic(Type.Number(), Number.parseFloat),
         }),
         {
            test: "{{ 3.14 }}",
         },
      );

      expect(result.test).toEqual(3.14);
   });
});
