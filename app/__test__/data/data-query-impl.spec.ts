import { describe, expect, test } from "bun:test";
import { Value } from "../../src/core/utils";
import { WhereBuilder, type WhereQuery, querySchema } from "../../src/data";
import { getDummyConnection } from "./helper";

describe("data-query-impl", () => {
   function qb() {
      const c = getDummyConnection();
      const kysely = c.dummyConnection.kysely;
      return kysely.selectFrom("t").selectAll();
   }
   function compile(q: WhereQuery) {
      const { sql, parameters } = WhereBuilder.addClause(qb(), q).compile();
      return { sql, parameters };
   }

   test("single validation", () => {
      const tests: [WhereQuery, string, any[]][] = [
         [{ name: "Michael", age: 40 }, '("name" = ? and "age" = ?)', ["Michael", 40]],
         [{ name: { $eq: "Michael" } }, '"name" = ?', ["Michael"]],
         [{ int: { $between: [1, 2] } }, '"int" between ? and ?', [1, 2]],
         [{ val: { $isnull: 1 } }, '"val" is null', []],
         [{ val: { $isnull: true } }, '"val" is null', []],
         [{ val: { $isnull: 0 } }, '"val" is not null', []],
         [{ val: { $isnull: false } }, '"val" is not null', []],
         [{ val: { $like: "what" } }, '"val" like ?', ["what"]],
         [{ val: { $like: "w*t" } }, '"val" like ?', ["w%t"]]
      ];

      for (const [query, expectedSql, expectedParams] of tests) {
         const { sql, parameters } = compile(query);
         expect(sql).toContain(`select * from "t" where ${expectedSql}`);
         expect(parameters).toEqual(expectedParams);
      }
   });

   test("multiple validations", () => {
      const tests: [WhereQuery, string, any[]][] = [
         // multiple constraints per property
         [{ val: { $lt: 10, $gte: 3 } }, '("val" < ? and "val" >= ?)', [10, 3]],
         [{ val: { $lt: 10, $gte: 3 } }, '("val" < ? and "val" >= ?)', [10, 3]],
         [{ val: { $lt: 10, $gte: 3 } }, '("val" < ? and "val" >= ?)', [10, 3]],

         // multiple properties
         [
            { val1: { $eq: "foo" }, val2: { $eq: "bar" } },
            '("val1" = ? and "val2" = ?)',
            ["foo", "bar"]
         ],
         [
            { val1: { $eq: "foo" }, val2: { $eq: "bar" } },
            '("val1" = ? and "val2" = ?)',
            ["foo", "bar"]
         ],

         // or constructs
         [
            { $or: { val1: { $eq: "foo" }, val2: { $eq: "bar" } } },
            '("val1" = ? or "val2" = ?)',
            ["foo", "bar"]
         ],
         [{ val1: { $eq: 1 }, $or: { val1: { $eq: 2 } } }, '("val1" = ? or "val1" = ?)', [1, 2]],
         [{ val1: { $eq: 1 }, $or: { val1: { $eq: 2 } } }, '("val1" = ? or "val1" = ?)', [1, 2]]
      ];

      for (const [query, expectedSql, expectedParams] of tests) {
         const { sql, parameters } = compile(query);
         expect(sql).toContain(`select * from "t" where ${expectedSql}`);
         expect(parameters).toEqual(expectedParams);
      }
   });

   test("keys", () => {
      const tests: [WhereQuery, string[]][] = [
         // multiple constraints per property
         [{ val: { $lt: 10, $gte: 3 } }, ["val"]],

         // multiple properties
         [{ val1: { $eq: "foo" }, val2: { $eq: "bar" } }, ["val1", "val2"]],

         // or constructs
         [{ $or: { val1: { $eq: "foo" }, val2: { $eq: "bar" } } }, ["val1", "val2"]],
         [{ val1: { $eq: 1 }, $or: { val1: { $eq: 2 } } }, ["val1"]]
      ];

      for (const [query, expectedKeys] of tests) {
         const keys = WhereBuilder.getPropertyNames(query);
         expect(keys).toEqual(expectedKeys);
      }
   });
});

describe("data-query-impl: Typebox", () => {
   test("sort", async () => {
      const decode = (input: any, expected: any) => {
         const result = Value.Decode(querySchema, input);
         expect(result.sort).toEqual(expected);
      };
      const _dflt = { by: "id", dir: "asc" };

      decode({ sort: "" }, _dflt);
      decode({ sort: "name" }, { by: "name", dir: "asc" });
      decode({ sort: "-name" }, { by: "name", dir: "desc" });
      decode({ sort: "-posts.name" }, { by: "posts.name", dir: "desc" });
      decode({ sort: "-1name" }, _dflt);
      decode({ sort: { by: "name", dir: "desc" } }, { by: "name", dir: "desc" });
   });
});
