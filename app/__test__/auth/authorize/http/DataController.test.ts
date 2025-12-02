import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createAuthTestApp } from "./shared";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";
import { em, entity, text } from "data/prototype";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

const schema = em(
   {
      posts: entity("posts", {
         title: text(),
         content: text(),
      }),
      comments: entity("comments", {
         content: text(),
      }),
   },
   ({ relation }, { posts, comments }) => {
      relation(posts).manyToOne(comments);
   },
);

describe("DataController (auth)", () => {
   test("reading schema.json", async () => {
      const { request } = await createAuthTestApp(
         {
            permission: ["system.access.api", "data.entity.read", "system.schema.read"],
            request: new Request("http://localhost/api/data/schema.json"),
         },
         {
            config: { data: schema.toJSON() },
         },
      );
      expect((await request.guest()).status).toBe(403);
      expect((await request.member()).status).toBe(403);
      expect((await request.authorized()).status).toBe(200);
      expect((await request.admin()).status).toBe(200);
   });
});
