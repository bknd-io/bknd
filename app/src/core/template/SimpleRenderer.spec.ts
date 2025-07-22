import { describe, expect, test } from "bun:test";
import { SimpleRenderer } from "./SimpleRenderer";

describe(SimpleRenderer, () => {
   const renderer = new SimpleRenderer(
      {
         name: "World",
         views: 123,
         nested: {
            foo: "bar",
            baz: ["quz", "foo"],
         },
         someArray: [1, 2, 3],
         enabled: true,
      },
      {
         renderKeys: true,
      },
   );

   test("strings", async () => {
      const tests = [
         ["Hello {{ name }}, count: {{views}}", "Hello World, count: 123"],
         ["Nested: {{nested.foo}}", "Nested: bar"],
         ["Nested: {{nested.baz[0]}}", "Nested: quz"],
      ] as const;

      for (const [template, expected] of tests) {
         expect(await renderer.renderString(template)).toEqual(expected);
      }
   });

   test("arrays", async () => {
      const tests = [
         [
            ["{{someArray[0]}}", "{{someArray[1]}}", "{{someArray[2]}}"],
            ["1", "2", "3"],
         ],
      ] as const;

      for (const [template, expected] of tests) {
         const result = await renderer.render(template);
         expect(result).toEqual(expected as any);
      }
   });

   test("objects", async () => {
      const tests = [
         [
            {
               foo: "{{name}}",
               bar: "{{views}}",
               baz: "{{nested.foo}}",
               quz: "{{nested.baz[0]}}",
            },
            {
               foo: "World",
               bar: "123",
               baz: "bar",
               quz: "quz",
            },
         ],
      ] as const;

      for (const [template, expected] of tests) {
         const result = await renderer.render(template);
         expect(result).toEqual(expected as any);
      }
   });
});
