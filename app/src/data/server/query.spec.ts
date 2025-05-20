import { test, describe, expect } from "bun:test";
import * as q from "./query";
import { s as schema, parse as $parse, type ParseOptions } from "core/object/schema";
import { querySchema } from "data";

const parse = (v: unknown, o: ParseOptions = {}) => $parse(q.repoQuery, v, o);

//console.log("querySchema", JSON.stringify(querySchema, null, 2));

console.log(JSON.stringify(q.repoQuery, null, 2));

describe("server/query", () => {
   test("limit & offset", () => {
      expect(() => parse({ limit: false })).toThrow();
      expect(parse({ limit: "11" })).toEqual({ limit: 11 });
      expect(parse({ limit: 20 })).toEqual({ limit: 20 });
      expect(parse({ offset: "1" })).toEqual({ offset: 1 });
   });

   test("select", () => {
      expect(parse({ select: "id" })).toEqual({ select: ["id"] });
      expect(parse({ select: "id,title" })).toEqual({ select: ["id", "title"] });
      expect(parse({ select: "id,title,desc" })).toEqual({ select: ["id", "title", "desc"] });
      expect(parse({ select: ["id", "title"] })).toEqual({ select: ["id", "title"] });

      expect(() => parse({ select: "not allowed" })).toThrow();
      expect(() => parse({ select: "id," })).toThrow();
   });

   test("join", () => {
      expect(parse({ join: "id" })).toEqual({ join: ["id"] });
      expect(parse({ join: "id,title" })).toEqual({ join: ["id", "title"] });
      expect(parse({ join: ["id", "title"] })).toEqual({ join: ["id", "title"] });
   });

   test("sort", () => {
      expect(parse({ sort: "id" }).sort).toEqual({
         by: "id",
         dir: "asc",
      });
      expect(parse({ sort: "-id" }).sort).toEqual({
         by: "id",
         dir: "desc",
      });
      expect(parse({ sort: { by: "title" } }).sort).toEqual({
         by: "title",
      });
      expect(
         parse(
            { sort: { by: "id" } },
            {
               withDefaults: true,
            },
         ).sort,
      ).toEqual({
         by: "id",
         dir: "asc",
      });
      expect(parse({ sort: { by: "count", dir: "desc" } }).sort).toEqual({
         by: "count",
         dir: "desc",
      });
      // invalid gives default
      expect(parse({ sort: "not allowed" }).sort).toEqual({
         by: "id",
         dir: "asc",
      });

      // json
      expect(parse({ sort: JSON.stringify({ by: "count", dir: "desc" }) }).sort).toEqual({
         by: "count",
         dir: "desc",
      });
   });

   test("where", () => {
      expect(parse({ where: { id: 1 } }).where).toEqual({
         id: { $eq: 1 },
      });
      expect(parse({ where: JSON.stringify({ id: 1 }) }).where).toEqual({
         id: { $eq: 1 },
      });

      expect(parse({ where: { count: { $gt: 1 } } }).where).toEqual({
         count: { $gt: 1 },
      });
      expect(parse({ where: JSON.stringify({ count: { $gt: 1 } }) }).where).toEqual({
         count: { $gt: 1 },
      });
   });

   test("with", () => {
      console.log(parse({ with: ["posts"] }));
      console.log(
         parse({
            with: {
               posts: { limit: false },
            },
         }),
      );
      //console.log();
   });
});
