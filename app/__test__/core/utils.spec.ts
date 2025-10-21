import { describe, expect, test } from "bun:test";
import { Perf, ucFirst } from "../../src/core/utils";
import * as utils from "../../src/core/utils";
import { assetsPath } from "../helper";

async function wait(ms: number) {
   return new Promise((resolve) => {
      setTimeout(resolve, ms);
   });
}

describe("Core Utils", async () => {
   describe("[core] strings", async () => {
      test("objectToKeyValueArray", async () => {
         const obj = { a: 1, b: 2, c: 3 };
         const result = utils.objectToKeyValueArray(obj);
         expect(result).toEqual([
            { key: "a", value: 1 },
            { key: "b", value: 2 },
            { key: "c", value: 3 },
         ]);
      });

      test("snakeToPascalWithSpaces", async () => {
         const result = utils.snakeToPascalWithSpaces("snake_to_pascal");
         expect(result).toBe("Snake To Pascal");
      });

      test("randomString", async () => {
         const result = utils.randomString(10);
         expect(result).toHaveLength(10);
      });

      test("pascalToKebab", async () => {
         const result = utils.pascalToKebab("PascalCase");
         expect(result).toBe("pascal-case");
      });

      test("replaceSimplePlaceholders", async () => {
         const str = "Hello, {$name}!";
         const vars = { name: "John" };
         const result = utils.replaceSimplePlaceholders(str, vars);
         expect(result).toBe("Hello, John!");
      });
   });

   describe("reqres", async () => {
      test("headersToObject", () => {
         const headers = new Headers();
         headers.append("Content-Type", "application/json");
         headers.append("Authorization", "Bearer 123");
         const obj = utils.headersToObject(headers);
         expect(obj).toEqual({
            "content-type": "application/json",
            authorization: "Bearer 123",
         });
      });

      test("replaceUrlParam", () => {
         const url = "/api/:id/:name";
         const params = { id: "123", name: "test" };
         const result = utils.replaceUrlParam(url, params);
         expect(result).toBe("/api/123/test");
      });

      test("encode", () => {
         const obj = { id: "123", name: "test" };
         const result = utils.encodeSearch(obj);
         expect(result).toBe("id=123&name=test");

         const obj2 = { id: "123", name: ["test1", "test2"] };
         const result2 = utils.encodeSearch(obj2);
         expect(result2).toBe("id=123&name=test1&name=test2");

         const obj3 = { id: "123", name: { test: "test" } };
         const result3 = utils.encodeSearch(obj3, { encode: true });
         expect(result3).toBe("id=123&name=%7B%22test%22%3A%22test%22%7D");
      });
   });

   describe("perf", async () => {
      test("marks", async () => {
         const perf = Perf.start();
         await wait(20);
         perf.mark("boot");

         await wait(10);
         perf.mark("another");
         perf.close();

         const perf2 = Perf.start();
         await wait(40);
         perf2.mark("booted");
         await wait(10);
         perf2.mark("what");
         perf2.close();

         expect(perf.result().total).toBeLessThan(perf2.result().total);
      });

      test("executes correctly", async () => {
         // write a test for "execute" method
         let count = 0;
         await Perf.execute(async () => {
            count += 1;
         }, 2);

         expect(count).toBe(2);
      });
   });

   describe("objects", () => {
      test("omitKeys", () => {
         const objects = [
            [{ a: 1, b: 2, c: 3 }, ["a"], { b: 2, c: 3 }],
            [{ a: 1, b: 2, c: 3 }, ["b"], { a: 1, c: 3 }],
            [{ a: 1, b: 2, c: 3 }, ["c"], { a: 1, b: 2 }],
            [{ a: 1, b: 2, c: 3 }, ["a", "b"], { c: 3 }],
            [{ a: 1, b: 2, c: 3 }, ["a", "b", "c"], {}],
         ] as [object, string[], object][];

         for (const [obj, keys, expected] of objects) {
            const result = utils.omitKeys(obj, keys as any);
            expect(result).toEqual(expected);
         }
      });

      test("isEqual", () => {
         const objects = [
            [1, 1, true],
            [1, "1", false],
            [1, 2, false],
            ["1", "1", true],
            ["1", "2", false],
            [true, true, true],
            [true, false, false],
            [false, false, true],
            [1, Number.NaN, false],
            [Number.NaN, Number.NaN, true],
            [null, null, true],
            [null, undefined, false],
            [undefined, undefined, true],
            [new Map([["a", 1]]), new Map([["a", 1]]), true],
            [new Map([["a", 1]]), new Map([["a", 2]]), false],
            [new Map([["a", 1]]), new Map([["b", 1]]), false],
            [
               new Map([["a", 1]]),
               new Map([
                  ["a", 1],
                  ["b", 2],
               ]),
               false,
            ],
            [{ a: 1 }, { a: 1 }, true],
            [{ a: 1 }, { a: 2 }, false],
            [{ a: 1 }, { b: 1 }, false],
            [{ a: "1" }, { a: "1" }, true],
            [{ a: "1" }, { a: "2" }, false],
            [{ a: "1" }, { b: "1" }, false],
            [{ a: 1 }, { a: 1, b: 2 }, false],
            [{ a: [1, 2, 3] }, { a: [1, 2, 3] }, true],
            [{ a: [1, 2, 3] }, { a: [1, 2, 4] }, false],
            [{ a: [1, 2, 3] }, { a: [1, 2, 3, 4] }, false],
            [{ a: { b: 1 } }, { a: { b: 1 } }, true],
            [{ a: { b: 1 } }, { a: { b: 2 } }, false],
            [{ a: { b: 1 } }, { a: { c: 1 } }, false],
            [{ a: { b: 1 } }, { a: { b: 1, c: 2 } }, false],
            [[1, 2, 3], [1, 2, 3], true],
            [[1, 2, 3], [1, 2, 4], false],
            [[1, 2, 3], [1, 2, 3, 4], false],
            [[{ a: 1 }], [{ a: 1 }], true],
            [[{ a: 1 }], [{ a: 2 }], false],
            [[{ a: 1 }], [{ b: 1 }], false],
         ] as [any, any, boolean][];

         for (const [a, b, expected] of objects) {
            const result = utils.isEqual(a, b);
            expect(result).toEqual(expected);
         }
      });

      test("getPath", () => {
         const tests = [
            [{ a: 1, b: 2, c: 3 }, "a", 1],
            [{ a: 1, b: 2, c: 3 }, "b", 2],
            [{ a: { b: 1 } }, "a.b", 1],
            [{ a: { b: 1 } }, "a.b.c", null, null],
            [{ a: { b: 1 } }, "a.b.c", 1, 1],
            [[[1]], "0.0", 1],
         ] as [object, string, any, any][];

         for (const [obj, path, expected, defaultValue] of tests) {
            const result = utils.getPath(obj, path, defaultValue);
            expect(result).toEqual(expected);
         }
      });

      test("recursivelyReplacePlaceholders", () => {
         // test basic replacement with simple pattern
         const obj1 = { a: "Hello, {$name}!", b: { c: "Hello, {$name}!" } };
         const variables1 = { name: "John" };
         const result1 = utils.recursivelyReplacePlaceholders(obj1, /\{\$(\w+)\}/g, variables1);
         expect(result1).toEqual({ a: "Hello, John!", b: { c: "Hello, John!" } });

         // test the specific example from the user request
         const obj2 = { some: "value", here: "@auth.user" };
         const variables2 = { auth: { user: "what" } };
         const result2 = utils.recursivelyReplacePlaceholders(obj2, /^@([a-z\.]+)$/, variables2);
         expect(result2).toEqual({ some: "value", here: "what" });

         // test with arrays
         const obj3 = { items: ["@config.name", "static", "@config.version"] };
         const variables3 = { config: { name: "MyApp", version: "1.0.0" } };
         const result3 = utils.recursivelyReplacePlaceholders(obj3, /^@([a-z\.]+)$/, variables3);
         expect(result3).toEqual({ items: ["MyApp", "static", "1.0.0"] });

         // test with nested objects and deep paths
         const obj4 = {
            user: "@auth.user.name",
            settings: {
               theme: "@ui.theme",
               nested: {
                  value: "@deep.nested.value",
               },
            },
         };
         const variables4 = {
            auth: { user: { name: "Alice" } },
            ui: { theme: "dark" },
            deep: { nested: { value: "found" } },
         };
         const result4 = utils.recursivelyReplacePlaceholders(obj4, /^@([a-z\.]+)$/, variables4);
         expect(result4).toEqual({
            user: "Alice",
            settings: {
               theme: "dark",
               nested: {
                  value: "found",
               },
            },
         });

         // test with missing paths (should return original match)
         const obj5 = { value: "@missing.path" };
         const variables5 = { existing: "value" };
         const result5 = utils.recursivelyReplacePlaceholders(obj5, /^@([a-z\.]+)$/, variables5);
         expect(result5).toEqual({ value: "@missing.path" });

         // test with non-matching strings (should remain unchanged)
         const obj6 = { value: "normal string", other: "not@matching" };
         const variables6 = { some: "value" };
         const result6 = utils.recursivelyReplacePlaceholders(obj6, /^@([a-z\.]+)$/, variables6);
         expect(result6).toEqual({ value: "normal string", other: "not@matching" });

         // test with primitive values (should handle gracefully)
         expect(
            utils.recursivelyReplacePlaceholders("@test.value", /^@([a-z\.]+)$/, {
               test: { value: "replaced" },
            }),
         ).toBe("replaced");
         expect(utils.recursivelyReplacePlaceholders(123, /^@([a-z\.]+)$/, {})).toBe(123);
         expect(utils.recursivelyReplacePlaceholders(null, /^@([a-z\.]+)$/, {})).toBe(null);

         // test type preservation for full string matches
         const variables7 = { test: { value: 123, flag: true, data: null, arr: [1, 2, 3] } };
         const result7 = utils.recursivelyReplacePlaceholders(
            {
               number: "@test.value",
               boolean: "@test.flag",
               nullValue: "@test.data",
               array: "@test.arr",
            },
            /^@([a-z\.]+)$/,
            variables7,
            null,
         );
         expect(result7).toEqual({
            number: 123,
            boolean: true,
            nullValue: null,
            array: [1, 2, 3],
         });

         // test partial string replacement (should convert to string)
         const result8 = utils.recursivelyReplacePlaceholders(
            { message: "The value is @test.value!" },
            /@([a-z\.]+)/g,
            variables7,
         );
         expect(result8).toEqual({ message: "The value is 123!" });

         // test with fallback parameter
         const obj9 = { user: "@user.id", config: "@config.theme" };
         const variables9 = {}; // empty context
         const result9 = utils.recursivelyReplacePlaceholders(
            obj9,
            /^@([a-z\.]+)$/,
            variables9,
            null,
         );
         expect(result9).toEqual({ user: null, config: null });

         // test with fallback for partial matches
         const obj10 = { message: "Hello @user.name, welcome!" };
         const variables10 = {}; // empty context
         const result10 = utils.recursivelyReplacePlaceholders(
            obj10,
            /@([a-z\.]+)/g,
            variables10,
            "Guest",
         );
         expect(result10).toEqual({ message: "Hello Guest, welcome!" });

         // test with different fallback types
         const obj11 = {
            stringFallback: "@missing.string",
            numberFallback: "@missing.number",
            booleanFallback: "@missing.boolean",
            objectFallback: "@missing.object",
         };
         const variables11 = {};
         const result11 = utils.recursivelyReplacePlaceholders(
            obj11,
            /^@([a-z\.]+)$/,
            variables11,
            "default",
         );
         expect(result11).toEqual({
            stringFallback: "default",
            numberFallback: "default",
            booleanFallback: "default",
            objectFallback: "default",
         });

         // test fallback with arrays
         const obj12 = { items: ["@item1", "@item2", "static"] };
         const variables12 = { item1: "found" }; // item2 is missing
         const result12 = utils.recursivelyReplacePlaceholders(
            obj12,
            /^@([a-zA-Z0-9\.]+)$/,
            variables12,
            "missing",
         );
         expect(result12).toEqual({ items: ["found", "missing", "static"] });

         // test fallback with nested objects
         const obj13 = {
            user: "@user.id",
            settings: {
               theme: "@theme.name",
               nested: {
                  value: "@deep.value",
               },
            },
         };
         const variables13 = {}; // empty context
         const result13 = utils.recursivelyReplacePlaceholders(
            obj13,
            /^@([a-z\.]+)$/,
            variables13,
            null,
         );
         expect(result13).toEqual({
            user: null,
            settings: {
               theme: null,
               nested: {
                  value: null,
               },
            },
         });
      });
   });

   describe("file", async () => {
      describe("type guards", () => {
         const types = {
            blob: new Blob(),
            file: new File([""], "file.txt"),
            stream: new ReadableStream(),
            arrayBuffer: new ArrayBuffer(10),
            arrayBufferView: new Uint8Array(new ArrayBuffer(10)),
         };

         const fns = [
            [utils.isReadableStream, "stream"],
            [utils.isBlob, "blob", ["stream", "arrayBuffer", "arrayBufferView"]],
            [utils.isFile, "file", ["stream", "arrayBuffer", "arrayBufferView"]],
            [utils.isArrayBuffer, "arrayBuffer"],
            [utils.isArrayBufferView, "arrayBufferView"],
         ] as const;

         const additional = [0, 0.0, "", null, undefined, {}, []];

         for (const [fn, type, _to_test] of fns) {
            test(`is${ucFirst(type)}`, () => {
               const to_test = _to_test ?? (Object.keys(types) as string[]);
               for (const key of to_test) {
                  const value = types[key as keyof typeof types];
                  const result = fn(value);
                  expect(result).toBe(key === type);
               }

               for (const value of additional) {
                  const result = fn(value);
                  expect(result).toBe(false);
               }
            });
         }
      });

      test("getContentName", () => {
         const name = "test.json";
         const text = "attachment; filename=" + name;
         const headers = new Headers({
            "Content-Disposition": text,
         });
         const request = new Request("http://example.com", {
            headers,
         });

         expect(utils.getContentName(text)).toBe(name);
         expect(utils.getContentName(headers)).toBe(name);
         expect(utils.getContentName(request)).toBe(name);
      });

      test("detectImageDimensions", async () => {
         // wrong
         // @ts-expect-error
         expect(utils.detectImageDimensions(new ArrayBuffer(), "text/plain")).rejects.toThrow();

         // successful ones
         const getFile = (name: string): File => Bun.file(`${assetsPath}/${name}`) as any;
         expect(await utils.detectImageDimensions(getFile("image.png"))).toEqual({
            width: 362,
            height: 387,
         });
         expect(await utils.detectImageDimensions(getFile("image.jpg"))).toEqual({
            width: 453,
            height: 512,
         });
      });
   });

   describe("dates", () => {
      test("formats local time", () => {
         expect(utils.datetimeStringUTC("2025-02-21T16:48:25.841Z")).toBe("2025-02-21 16:48:25");
         /*console.log(utils.datetimeStringUTC(new Date()));
         console.log(utils.datetimeStringUTC());
         console.log(new Date());
         console.log("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone); */
      });
   });
});
