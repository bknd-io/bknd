import { AuthStrategy, registries } from "bknd";
import { describe, it, expect } from "bun:test";
import { createApp } from "core/test/utils";
import { s } from "bknd/utils";
import { Hono } from "hono";

const customStrategySchema = s.object({
   name: s.string(),
});
type CustomStrategyOptions = s.Static<typeof customStrategySchema>;

class CustomStrategy extends AuthStrategy<typeof customStrategySchema> {
   constructor(config: Partial<CustomStrategyOptions> = {}) {
      super(config as any, "custom", "custom", "form");
   }
   getSchema() {
      return customStrategySchema;
   }

   getController() {
      return new Hono()
         .post("/login", async (c) => {
            return c.json({
               message: "Hello, world!",
            });
         })
         .post("/register", async (c) => {
            return c.json({
               message: "Hello, world!",
            });
         });
   }
}

describe("custom auth strategy", () => {
   it("should be registered", async () => {
      registries.auth.register("custom", CustomStrategy);

      const app = createApp({
         initialConfig: {
            auth: {
               enabled: true,
            },
         },
      });
      await app.build();

      const strategies = app
         .getSchema()
         .auth.properties.strategies.additionalProperties.anyOf.map((s) => s.properties.type.const);

      expect(strategies).toContain("custom");
   });
});
