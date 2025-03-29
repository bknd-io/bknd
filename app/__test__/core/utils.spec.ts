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

      test.only("detectImageDimensions", async () => {
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
      test.only("formats local time", () => {
         expect(utils.datetimeStringUTC("2025-02-21T16:48:25.841Z")).toBe("2025-02-21 16:48:25");
         console.log(utils.datetimeStringUTC(new Date()));
         console.log(utils.datetimeStringUTC());
         console.log(new Date());
         console.log("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
      });
   });
});
