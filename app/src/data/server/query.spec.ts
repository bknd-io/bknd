import { test, describe, expect } from "bun:test";
import * as q from "./query";
import { parse as $parse, type ParseOptions } from "bknd/utils";

const parse = (v: unknown, o: ParseOptions = {}) =>
   $parse(q.repoQuery, v, {
      ...o,
      withDefaults: false,
   });

// compatibility
const decode = (input: any, output: any) => {
   expect(parse(input)).toEqual(output);
};

describe("server/query", () => {
   test("limit & offset", () => {
      //expect(() => parse({ limit: false })).toThrow();
      expect(parse({ limit: "11" })).toEqual({ limit: 11 });
      expect(parse({ limit: 20 })).toEqual({ limit: 20 });
      expect(parse({ offset: "1" })).toEqual({ offset: 1 });
   });

   test("select", () => {
      expect(parse({ select: "id" })).toEqual({ select: ["id"] });
      expect(parse({ select: "id,title" })).toEqual({ select: ["id", "title"] });
      expect(parse({ select: "id,title,desc" })).toEqual({ select: ["id", "title", "desc"] });
      expect(parse({ select: ["id", "title"] })).toEqual({ select: ["id", "title"] });
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
         dir: "asc",
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

   test("sort2", () => {
      const _dflt = { sort: { by: "id", dir: "asc" } } as const;

      decode({ sort: "" }, _dflt);
      decode({ sort: "name" }, { sort: { by: "name", dir: "asc" } });
      decode({ sort: "-name" }, { sort: { by: "name", dir: "desc" } });
      decode({ sort: "-posts.name" }, { sort: { by: "posts.name", dir: "desc" } });
      decode({ sort: "-1name" }, _dflt);
      decode({ sort: { by: "name", dir: "desc" } }, { sort: { by: "name", dir: "desc" } });
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

   test("template", () => {
      expect(
         q.repoQuery.template(
            {},
            {
               withOptional: true,
            },
         ),
      ).toEqual({
         limit: 10,
         offset: 0,
         sort: { by: "id", dir: "asc" },
         where: {},
         select: [],
         join: [],
      });
   });

   test("with", () => {
      let example = {
         limit: 10,
         with: {
            posts: { limit: "10", with: ["comments"] },
         },
      };
      expect(parse(example)).toEqual({
         limit: 10,
         with: {
            posts: {
               limit: 10,
               with: {
                  comments: {},
               },
            },
         },
      });

      decode({ with: ["posts"] }, { with: { posts: {} } });
      decode({ with: { posts: {} } }, { with: { posts: {} } });
      decode({ with: { posts: { limit: 1 } } }, { with: { posts: { limit: 1 } } });
      decode(
         {
            with: {
               posts: {
                  with: {
                     images: {
                        limit: "10",
                        select: "id",
                     },
                  },
               },
            },
         },
         {
            with: {
               posts: {
                  with: {
                     images: {
                        limit: 10,
                        select: ["id"],
                     },
                  },
               },
            },
         },
      );

      // over http
      {
         const output = { with: { images: {} } };
         decode({ with: "images" }, output);
         decode({ with: '["images"]' }, output);
         decode({ with: ["images"] }, output);
         decode({ with: { images: {} } }, output);
      }

      {
         const output = { with: { images: {}, comments: {} } };
         decode({ with: "images,comments" }, output);
         decode({ with: ["images", "comments"] }, output);
         decode({ with: '["images", "comments"]' }, output);
         decode({ with: { images: {}, comments: {} } }, output);
      }
   });
});
