import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createApp } from "core/test/utils";
import type { CreateAppConfig } from "App";
import * as proto from "data/prototype";
import { mergeObject } from "core/utils/objects";
import type { App, DB } from "bknd";
import type { CreateUserPayload } from "auth/AppAuth";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

async function makeApp(config: Partial<CreateAppConfig["config"]> = {}) {
   const app = createApp({
      config: mergeObject(
         {
            data: proto
               .em(
                  {
                     users: proto.systemEntity("users", {}),
                     posts: proto.entity("posts", {
                        title: proto.text(),
                        content: proto.text(),
                     }),
                     comments: proto.entity("comments", {
                        content: proto.text(),
                     }),
                  },
                  ({ relation }, { users, posts, comments }) => {
                     relation(posts).manyToOne(users);
                     relation(comments).manyToOne(posts);
                  },
               )
               .toJSON(),
            auth: {
               enabled: true,
               jwt: {
                  secret: "secret",
               },
            },
         },
         config,
      ),
   });
   await app.build();

   return app;
}

async function createUsers(app: App, users: CreateUserPayload[]) {
   return Promise.all(
      users.map(async (user) => {
         return await app.createUser(user);
      }),
   );
}

async function loadFixtures(app: App, fixtures: Record<string, any[]> = {}) {
   const results = {} as any;
   for (const [entity, data] of Object.entries(fixtures)) {
      results[entity] = await app.em
         .mutator(entity as any)
         .insertMany(data)
         .then((result) => result.data);
   }
   return results;
}

describe("data permissions", async () => {
   const app = await makeApp({
      server: {
         mcp: {
            enabled: true,
         },
      },
      auth: {
         guard: {
            enabled: true,
         },
         roles: {
            guest: {
               is_default: true,
               permissions: [
                  {
                     permission: "system.access.api",
                  },
                  {
                     permission: "data.entity.read",
                     policies: [
                        {
                           condition: {
                              entity: "posts",
                           },
                           effect: "filter",
                           filter: {
                              users_id: { $isnull: 1 },
                           },
                        },
                     ],
                  },
                  {
                     permission: "data.entity.create",
                     policies: [
                        {
                           condition: {
                              entity: "posts",
                           },
                           effect: "filter",
                           filter: {
                              users_id: { $isnull: 1 },
                           },
                        },
                     ],
                  },
                  {
                     permission: "data.entity.update",
                     policies: [
                        {
                           condition: {
                              entity: "posts",
                           },
                           effect: "filter",
                           filter: {
                              users_id: { $isnull: 1 },
                           },
                        },
                     ],
                  },
                  {
                     permission: "data.entity.delete",
                     policies: [
                        {
                           condition: { entity: "posts" },
                        },
                        {
                           condition: { entity: "posts" },
                           effect: "filter",
                           filter: {
                              users_id: { $isnull: 1 },
                           },
                        },
                     ],
                  },
               ],
            },
         },
      },
   });
   const users = [
      { email: "foo@example.com", password: "password" },
      { email: "bar@example.com", password: "password" },
   ];
   const fixtures = {
      posts: [
         { content: "post 1", users_id: 1 },
         { content: "post 2", users_id: 2 },
         { content: "post 3", users_id: null },
      ],
      comments: [
         { content: "comment 1", posts_id: 1 },
         { content: "comment 2", posts_id: 2 },
         { content: "comment 3", posts_id: 3 },
      ],
   };
   await createUsers(app, users);
   const results = await loadFixtures(app, fixtures);

   describe("http", async () => {
      it("read many", async () => {
         // many only includes posts with users_id is null
         const res = await app.server.request("/api/data/entity/posts");
         const data = await res.json().then((r: any) => r.data);
         expect(data).toEqual([results.posts[2]]);

         // same with /query
         {
            const res = await app.server.request("/api/data/entity/posts/query", {
               method: "POST",
            });
            const data = await res.json().then((r: any) => r.data);
            expect(data).toEqual([results.posts[2]]);
         }
      });

      it("read one", async () => {
         // one only includes posts with users_id is null
         {
            const res = await app.server.request("/api/data/entity/posts/1");
            const data = await res.json().then((r: any) => r.data);
            expect(res.status).toBe(404);
            expect(data).toBeUndefined();
         }

         // read one by allowed id
         {
            const res = await app.server.request("/api/data/entity/posts/3");
            const data = await res.json().then((r: any) => r.data);
            expect(res.status).toBe(200);
            expect(data).toEqual(results.posts[2]);
         }
      });

      it("read many by reference", async () => {
         const res = await app.server.request("/api/data/entity/posts/1/comments");
         const data = await res.json().then((r: any) => r.data);
         expect(res.status).toBe(200);
         expect(data).toEqual(results.comments.filter((c: any) => c.posts_id === 1));
      });

      it("mutation create one", async () => {
         // not allowed
         {
            const res = await app.server.request("/api/data/entity/posts", {
               method: "POST",
               body: JSON.stringify({ content: "post 4" }),
            });
            expect(res.status).toBe(403);
         }
         // allowed
         {
            const res = await app.server.request("/api/data/entity/posts", {
               method: "POST",
               body: JSON.stringify({ content: "post 4", users_id: null }),
            });
            expect(res.status).toBe(201);
         }
      });

      it("mutation update one", async () => {
         // update one: not allowed
         const res = await app.server.request("/api/data/entity/posts/1", {
            method: "PATCH",
            body: JSON.stringify({ content: "post 4" }),
         });
         expect(res.status).toBe(403);

         {
            // update one: allowed
            const res = await app.server.request("/api/data/entity/posts/3", {
               method: "PATCH",
               body: JSON.stringify({ content: "post 3 (updated)" }),
            });
            expect(res.status).toBe(200);
            expect(await res.json().then((r: any) => r.data.content)).toBe("post 3 (updated)");
         }
      });

      it("mutation update many", async () => {
         // update many: not allowed
         const res = await app.server.request("/api/data/entity/posts", {
            method: "PATCH",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({
               update: { content: "post 4" },
               where: { users_id: { $isnull: 0 } },
            }),
         });
         expect(res.status).toBe(200); // because filtered
         const _data = await res.json().then((r: any) => r.data.map((p: any) => p.users_id));
         expect(_data.every((u: any) => u === null)).toBe(true);

         // verify
         const data = await app.em
            .repo("posts")
            .findMany({ select: ["content", "users_id"] })
            .then((r) => r.data);

         // expect non null users_id to not have content "post 4"
         expect(
            data.filter((p: any) => p.users_id !== null).every((p: any) => p.content !== "post 4"),
         ).toBe(true);
         // expect null users_id to have content "post 4"
         expect(
            data.filter((p: any) => p.users_id === null).every((p: any) => p.content === "post 4"),
         ).toBe(true);
      });

      const count = async () => {
         const {
            data: { count: _count },
         } = await app.em.repo("posts").count();
         return _count;
      };
      it("mutation delete one", async () => {
         const initial = await count();

         // delete one: not allowed
         const res = await app.server.request("/api/data/entity/posts/1", {
            method: "DELETE",
         });
         expect(res.status).toBe(403);
         expect(await count()).toBe(initial);

         {
            // delete one: allowed
            const res = await app.server.request("/api/data/entity/posts/3", {
               method: "DELETE",
            });
            expect(res.status).toBe(200);
            expect(await count()).toBe(initial - 1);
         }
      });

      it("mutation delete many", async () => {
         // delete many: not allowed
         const res = await app.server.request("/api/data/entity/posts", {
            method: "DELETE",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({
               where: {},
            }),
         });
         expect(res.status).toBe(200);

         // only deleted posts with users_id is null
         const remaining = await app.em
            .repo("posts")
            .findMany()
            .then((r) => r.data);
         expect(remaining.every((p: any) => p.users_id !== null)).toBe(true);
      });
   });
});
