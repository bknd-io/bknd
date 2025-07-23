import { AuthStrategy, registries, type Authenticator } from "bknd";
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

   getController(authenticator: Authenticator) {
      return new Hono()
         .post("/login", async (c) => {
            try {
               // do magic, and it succeeds, resolve login

               // @ts-ignore
               return await authenticator.resolveLogin();
            } catch (e) {
               // in case of error, respond with the error
               return authenticator.respondWithError(c, e as any);
            }
         })
         .post("/register", async (c) => {
            try {
               // do magic, and it succeeds, resolve register
               // @ts-ignore
               return await authenticator.resolveRegister();
            } catch (e) {
               // in case of error, respond with the error
               return authenticator.respondWithError(c, e as any);
            }
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
