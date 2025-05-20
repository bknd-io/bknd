import { describe, expect, test } from "bun:test";
import { type ObjectQuery, convert, validate } from "core/object/query/object-query";

describe("object-query", () => {
   const q: ObjectQuery = { name: "Michael" };
   const q2: ObjectQuery = { name: { $isnull: 1 } };
   const q3: ObjectQuery = { name: "Michael", age: { $gt: 18 } };
   const bag = { q, q2, q3 };

   test("validates", async () => {
      const converted = convert({
         name: { $eq: "ch" },
      });
      validate(converted, { name: "Michael" });
   });

   test("single validation", () => {
      const tests: [ObjectQuery, any, boolean][] = [
         [{ name: { $eq: 1 } }, { name: "Michael" }, false],
         [{ name: "Michael", age: 40 }, { name: "Michael", age: 40 }, true],
         [{ name: "Michael", age: 40 }, { name: "Michael", age: 41 }, false],
         [{ name: { $eq: "Michael" } }, { name: "Michael" }, true],
         [{ int: { $between: [1, 2] } }, { int: 1 }, true],
         [{ int: { $between: [1, 2] } }, { int: 3 }, false],
         [{ some: { $isnull: 1 } }, { some: null }, true],
         [{ some: { $isnull: true } }, { some: null }, true],
         [{ some: { $isnull: 0 } }, { some: null }, false],
         [{ some: { $isnull: false } }, { some: null }, false],
         [{ some: { $isnull: 1 } }, { some: 1 }, false],
         [{ val: { $notnull: 1 } }, { val: 1 }, true],
         [{ val: { $notnull: 1 } }, { val: null }, false],
         [{ val: { $regex: ".*" } }, { val: "test" }, true],
         [{ val: { $regex: /^t.*/ } }, { val: "test" }, true],
         [{ val: { $regex: /^b.*/ } }, { val: "test" }, false],
      ];

      for (const [query, object, expected] of tests) {
         const result = validate(query, object);
         expect(result).toBe(expected);
      }
   });

   test("multiple validations", () => {
      const tests: [ObjectQuery, any, boolean][] = [
         // multiple constraints per property
         [{ val: { $lt: 10, $gte: 3 } }, { val: 7 }, true],
         [{ val: { $lt: 10, $gte: 3 } }, { val: 2 }, false],
         [{ val: { $lt: 10, $gte: 3 } }, { val: 11 }, false],

         // multiple properties
         [{ val1: { $eq: "foo" }, val2: { $eq: "bar" } }, { val1: "foo", val2: "bar" }, true],
         [{ val1: { $eq: "foo" }, val2: { $eq: "bar" } }, { val1: "bar", val2: "foo" }, false],

         // or constructs
         [
            { $or: { val1: { $eq: "foo" }, val2: { $eq: "bar" } } },
            { val1: "foo", val2: "bar" },
            true,
         ],
         [{ val1: { $eq: 1 }, $or: { val1: { $eq: 2 } } }, { val1: 1 }, true],
         [{ val1: { $eq: 1 }, $or: { val1: { $eq: 2 } } }, { val1: 3 }, false],
      ];

      for (const [query, object, expected] of tests) {
         const result = validate(query, object);
         expect(result).toBe(expected);
      }
   });
});
