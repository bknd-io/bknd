import { afterAll, beforeAll, describe, expect, it, expectTypeOf } from "bun:test";
import { Guard } from "../../src/auth/authorize/Guard";
import { DataApi } from "../../src/data/api/DataApi";
import { DataController } from "../../src/data/api/DataController";
import { dataConfigSchema } from "../../src/data/data-schema";
import * as proto from "../../src/data/prototype";
import { schemaToEm } from "../helper";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";
import { parse } from "core/utils/schema";
import type { Generated } from "kysely";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

const dataConfig = parse(dataConfigSchema, {});
describe("DataApi", () => {
   it("should switch to post for long url reads", async () => {
      const api = new DataApi();

      const get = api.readMany("a".repeat(300), { select: ["id", "name"] });
      expect(get.request.method).toBe("GET");
      expect(new URL(get.request.url).pathname).toBe(`/api/data/entity/${"a".repeat(300)}`);

      const post = api.readMany("a".repeat(1000), { select: ["id", "name"] });
      expect(post.request.method).toBe("POST");
      expect(new URL(post.request.url).pathname).toBe(`/api/data/entity/${"a".repeat(1000)}/query`);
   });

   it("returns result", async () => {
      const schema = proto.em({
         posts: proto.entity("posts", { title: proto.text() }),
      });
      const em = schemaToEm(schema);
      await em.schema().sync({ force: true });

      const payload = [{ title: "foo" }, { title: "bar" }, { title: "baz" }];
      await em.mutator("posts").insertMany(payload);

      const ctx: any = { em, guard: new Guard() };
      const controller = new DataController(ctx, dataConfig);
      const app = controller.getController();

      {
         const res = (await app.request("/entity/posts")) as Response;
         const { data } = (await res.json()) as any;
         expect(data.length).toEqual(3);
      }

      // @ts-ignore tests
      const api = new DataApi({ basepath: "/", queryLengthLimit: 50 }, app.request as typeof fetch);
      {
         const req = api.readMany("posts", { select: ["title"] });
         expect(req.request.method).toBe("GET");
         const res = await req;
         expect(res.data).toEqual(payload as any);
      }

      {
         const req = api.readMany("posts", {
            select: ["title"],
            limit: 100000,
            offset: 0,
            sort: "id",
         });
         expect(req.request.method).toBe("POST");
         const res = await req;
         expect(res.data).toEqual(payload as any);
      }

      {
         // make sure sort is working
         const req = await api.readMany("posts", {
            select: ["title"],
            sort: "-id",
         });
         expect(req.data).toEqual(payload.reverse() as any);
      }
   });

   it("updates many", async () => {
      const schema = proto.em({
         posts: proto.entity("posts", { title: proto.text(), count: proto.number() }),
      });
      const em = schemaToEm(schema);
      await em.schema().sync({ force: true });

      const payload = [
         { title: "foo", count: 0 },
         { title: "bar", count: 0 },
         { title: "baz", count: 0 },
         { title: "bla", count: 2 },
      ];
      await em.mutator("posts").insertMany(payload);

      const ctx: any = { em, guard: new Guard() };
      const controller = new DataController(ctx, dataConfig);
      const app = controller.getController();

      // @ts-ignore tests
      const api = new DataApi({ basepath: "/" }, app.request as typeof fetch);
      {
         const req = api.readMany("posts", {
            select: ["title", "count"],
         });
         const res = await req;
         expect(res.data).toEqual(payload as any);
      }

      {
         // update with empty where
         expect(() => api.updateMany("posts", {}, { count: 1 })).toThrow();
         expect(() => api.updateMany("posts", undefined, { count: 1 })).toThrow();
      }

      {
         // update
         const req = await api.updateMany("posts", { count: 0 }, { count: 1 });
         expect(req.res.status).toBe(200);
      }

      {
         // compare
         const res = await api.readMany("posts", {
            select: ["title", "count"],
         });
         expect(res.map((p) => p.count)).toEqual([1, 1, 1, 2]);
      }
   });

   it("refines", async () => {
      const schema = proto.em({
         posts: proto.entity("posts", { title: proto.text() }),
      });
      const em = schemaToEm(schema);
      await em.schema().sync({ force: true });

      const payload = [{ title: "foo" }, { title: "bar" }, { title: "baz" }];
      await em.mutator("posts").insertMany(payload);

      const ctx: any = { em, guard: new Guard() };
      const controller = new DataController(ctx, dataConfig);
      const app = controller.getController();

      const api = new DataApi({ basepath: "/" }, app.request as typeof fetch);
      const normalOne = api.readOne("posts", 1);
      const normal = api.readMany("posts", { select: ["title"], where: { title: "baz" } });
      expect((await normal).data).toEqual([{ title: "baz" }] as any);

      // refine
      const refined = normal.refine((data) => data[0]);
      expect((await refined).data).toEqual({ title: "baz" } as any);

      // one
      const oneBy = api.readOneBy("posts", { where: { title: "baz" }, select: ["title"] });
      const oneByRes = await oneBy;
      expect(oneByRes.data).toEqual({ title: "baz" } as any);
      expect(oneByRes.body.meta.items).toEqual(1);
   });

   it("exists/count", async () => {
      const schema = proto.em({
         posts: proto.entity("posts", { title: proto.text() }),
      });
      const em = schemaToEm(schema);
      await em.schema().sync({ force: true });

      const payload = [{ title: "foo" }, { title: "bar" }, { title: "baz" }];
      await em.mutator("posts").insertMany(payload);

      const ctx: any = { em, guard: new Guard() };
      const controller = new DataController(ctx, dataConfig);
      const app = controller.getController();

      const api = new DataApi({ basepath: "/" }, app.request as typeof fetch);

      const exists = api.exists("posts", { id: 1 });
      expect((await exists).exists).toBeTrue();

      expect((await api.count("posts")).count).toEqual(3);
   });

   it("creates many", async () => {
      const schema = proto.em({
         posts: proto.entity("posts", { title: proto.text(), count: proto.number() }),
      });
      const em = schemaToEm(schema);
      await em.schema().sync({ force: true });

      const payload = [
         { title: "foo", count: 0 },
         { title: "bar", count: 0 },
         { title: "baz", count: 0 },
         { title: "bla", count: 2 },
      ];

      const ctx: any = { em, guard: new Guard() };
      const controller = new DataController(ctx, dataConfig);
      const app = controller.getController();

      // @ts-ignore tests
      const api = new DataApi({ basepath: "/" }, app.request as typeof fetch);

      {
         // create many
         const res = await api.createMany("posts", payload);
         expect(res.data?.length).toEqual(4);
         expect(res.ok).toBeTrue();
      }

      {
         const req = api.readMany("posts", {
            select: ["title", "count"],
         });
         const res = await req;
         expect(res.data).toEqual(payload as any);
      }

      {
         // create with empty
         expect(() => api.createMany("posts", [])).toThrow();
      }
   });

   describe("types", async () => {
      const schema = proto.em(
         {
            posts: proto.entity("posts", { title: proto.text(), count: proto.number() }),
            comments: proto.entity("comments", { text: proto.text() }),
         },
         (fn, s) => {
            fn.relation(s.comments).manyToOne(s.posts);
         },
      );
      const em = schemaToEm(schema);
      await em.schema().sync({ force: true });

      const data = {
         posts: [
            { title: "foo", count: 0 },
            { title: "bar", count: 0 },
            { title: "baz", count: 0 },
            { title: "bla", count: 2 },
         ],
         comments: [
            { text: "comment1", posts_id: 1 },
            { text: "comment2", posts_id: 1 },
            { text: "comment3", posts_id: 2 },
         ],
      };

      const ctx: any = { em, guard: new Guard() };
      const controller = new DataController(ctx, dataConfig);
      const app = controller.getController();

      type Posts = {
         id: Generated<number>;
         title?: string;
         count?: number;
         comments?: Comments[];
      };
      type Comments = {
         id: Generated<number>;
         text?: string;
         posts_id?: number;
         posts?: Posts;
      };
      type DB = {
         posts: Posts;
         comments: Comments;
      };

      const api = new DataApi<DB>({ basepath: "/" }, app.request);
      for (const [entity, payload] of Object.entries(data)) {
         await api.createMany(entity as any, payload);
      }

      it("readOne", async () => {
         const result = await api.readOne("posts", 1);
         const expected = { id: 1, title: "foo", count: 0 } as any;
         expect(result.res).toBeInstanceOf(Response);
         expect(result.data).toEqual(expected);
         expect(result.body.meta.items).toEqual(1);

         expectTypeOf<(typeof result)["data"]>().toEqualTypeOf<Posts | null>();

         {
            // not found
            const result = await api.readOne("posts", 0);
            expect(result.res.status).toEqual(404);
            expect(result.data).toBeNull();
            expect(result.body.meta.items).toEqual(0);
            expectTypeOf<(typeof result)["data"]>().toEqualTypeOf<Posts | null>();
         }
      });

      it("readOneBy", async () => {
         const result = await api.readOneBy("posts", { where: { title: "foo" } });
         const expected = { id: 1, title: "foo", count: 0 } as any;
         expect(result.res.status).toEqual(200);
         expect(result.data).toEqual(expected);
         // @ts-expect-error body data is typed same as data...
         expect(result.body.data).toEqual([expected]); // should be array
         expect(result.body.meta.items).toEqual(1);
         expectTypeOf<(typeof result)["data"]>().toEqualTypeOf<Posts | null>();

         {
            // not found
            const result = await api.readOneBy("posts", { where: { title: "not found" } });
            // since we're filtering, the result is okay, but empty
            expect(result.res.status).toEqual(200);
            expect(result.data).toBeNull();
            // @ts-expect-error body data is typed same as data...
            expect(result.body.data).toEqual([]);
            expect(result.body.meta.items).toEqual(0);
            expectTypeOf<(typeof result)["data"]>().toEqualTypeOf<Posts | null>();
         }
      });

      it("readMany", async () => {
         const result = await api.readMany("posts", { where: { title: "foo" } });
         const expected = [{ id: 1, title: "foo", count: 0 }] as any;
         expect(result.res.status).toEqual(200);
         expect(result.data).toEqual(expected);
         expect(result.body.data).toEqual(expected);
         expect(result.body.meta.items).toEqual(1);
         expectTypeOf<(typeof result)["data"]>().toEqualTypeOf<Posts[]>();

         {
            // not found
            const result = await api.readMany("posts", { where: { title: "not found" } });
            expect(result.res.status).toEqual(200);
            expect(result.data).toEqual([]);
            expect(result.body.meta.items).toEqual(0);
            expectTypeOf<(typeof result)["data"]>().toEqualTypeOf<Posts[]>();
         }
      });

      it("readManyByReference", async () => {
         const result = await api.readManyByReference("posts", 1, "comments");
         const expected = [
            { id: 1, text: "comment1", posts_id: 1 },
            { id: 2, text: "comment2", posts_id: 1 },
         ] as any;
         expect(result.res.status).toEqual(200);
         expect(result.data).toEqual(expected);
         expect(result.body.meta.items).toEqual(2);
         expectTypeOf<(typeof result)["data"]>().toEqualTypeOf<Comments[]>();

         {
            // empty
            const result = await api.readManyByReference("posts", 3, "comments");
            expect(result.res.status).toEqual(200);
            expect(result.data).toEqual([]);
            expect(result.body.meta.items).toEqual(0);
            expectTypeOf<(typeof result)["data"]>().toEqualTypeOf<Comments[]>();
         }

         {
            // non existing (expected, since only 1 query is performed)
            const result = await api.readManyByReference("posts", 100, "comments");
            expect(result.res.status).toEqual(200);
            expect(result.data).toEqual([]);
         }
      });
   });
});
