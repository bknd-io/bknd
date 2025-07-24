import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Guard } from "../../src/auth";
import { parse } from "../../src/core/utils";
import { DataApi } from "../../src/data/api/DataApi";
import { DataController } from "../../src/data/api/DataController";
import { dataConfigSchema } from "../../src/data/data-schema";
import * as proto from "../../src/data/prototype";
import { schemaToEm } from "../helper";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";

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
         expect(res.data.length).toEqual(4);
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
});
