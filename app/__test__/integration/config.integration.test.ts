import { describe, expect, it } from "bun:test";
import { createApp } from "core/test/utils";
import { Api } from "../../src/Api";

describe("integration config", () => {
   it("should create an entity", async () => {
      const app = createApp();
      await app.build();
      const api = new Api({
         host: "http://localhost",
         fetcher: app.server.request as typeof fetch,
      });

      // create entity
      await api.system.addConfig("data", "entities.posts", {
         config: { sort_field: "id", sort_dir: "asc" },
         fields: { id: { type: "primary" }, asdf: { type: "text" } },
         type: "regular",
      });

      expect(app.em.entities.map((e) => e.name)).toContain("posts");
   });
});
