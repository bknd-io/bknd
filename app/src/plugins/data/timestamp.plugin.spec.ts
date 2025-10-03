import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { timestamps } from "./timestamps.plugin";
import { em, entity, text } from "bknd";
import { createApp } from "core/test/utils";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";

beforeAll(() => disableConsoleLog());
afterAll(enableConsoleLog);

describe("timestamps plugin", () => {
   test("should ignore if no or invalid entities are provided", async () => {
      const app = createApp({
         options: {
            plugins: [timestamps({ entities: [] })],
         },
      });
      await app.build();
      expect(app.em.entities.map((e) => e.name)).toEqual([]);

      {
         const app = createApp({
            options: {
               plugins: [timestamps({ entities: ["posts"] })],
            },
         });
         await app.build();
         expect(app.em.entities.map((e) => e.name)).toEqual([]);
      }
   });

   test("should add timestamps to the specified entities", async () => {
      const app = createApp({
         config: {
            data: em({
               posts: entity("posts", {
                  title: text(),
               }),
            }).toJSON(),
         },
         options: {
            plugins: [timestamps({ entities: ["posts", "invalid"] })],
         },
      });
      await app.build();
      expect(app.em.entities.map((e) => e.name)).toEqual(["posts"]);
      expect(app.em.entity("posts")?.fields.map((f) => f.name)).toEqual([
         "id",
         "title",
         "created_at",
         "updated_at",
      ]);

      // insert
      const mutator = app.em.mutator(app.em.entity("posts"));
      const { data } = await mutator.insertOne({ title: "Hello" });
      expect(data.created_at).toBeDefined();
      expect(data.updated_at).toBeDefined();
      expect(data.created_at).toBeInstanceOf(Date);
      expect(data.updated_at).toBeInstanceOf(Date);
      const diff = data.created_at.getTime() - data.updated_at.getTime();
      expect(diff).toBeLessThan(10);
      expect(diff).toBeGreaterThan(-1);

      // update (set updated_at to null, otherwise it's too fast to test)
      await app.em.connection.kysely
         .updateTable("posts")
         .set({ updated_at: null })
         .where("id", "=", data.id)
         .execute();
      const { data: updatedData } = await mutator.updateOne(data.id, { title: "Hello 2" });
      expect(updatedData.updated_at).toBeDefined();
      expect(updatedData.updated_at).toBeInstanceOf(Date);
   });
});
