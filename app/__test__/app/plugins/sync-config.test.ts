import { describe, it, expect, mock } from "bun:test";
import { createApp } from "core/test/utils";
import { syncConfig } from "plugins/dev/sync-config.plugin";

describe("syncConfig", () => {
   it("should only sync if enabled", async () => {
      const called = mock(() => null);
      const app = createApp();
      await app.build();

      await syncConfig({
         write: () => {
            called();
         },
         enabled: false,
         includeFirstBoot: false,
      })(app).onBuilt?.();
      expect(called).not.toHaveBeenCalled();

      await syncConfig({
         write: () => {
            called();
         },
         enabled: false,
         includeFirstBoot: true,
      })(app).onBuilt?.();
      expect(called).not.toHaveBeenCalled();

      await syncConfig({
         write: () => {
            called();
         },
         enabled: true,
         includeFirstBoot: true,
      })(app).onBuilt?.();
      expect(called).toHaveBeenCalledTimes(1);
   });

   it("should respect secrets", async () => {
      const called = mock(() => null);
      const app = createApp({
         config: {
            auth: {
               enabled: true,
               jwt: {
                  secret: "test",
               },
            },
         },
      });
      await app.build();

      await syncConfig({
         write: async (config) => {
            called();
            expect(config.auth.jwt.secret).toBe("test");
         },
         enabled: true,
         includeSecrets: true,
         includeFirstBoot: true,
      })(app).onBuilt?.();

      await syncConfig({
         write: async (config) => {
            called();
            // it's an important test, because the `jwt` part is omitted if secrets=false in general app.toJSON()
            // but it's required to get the app running
            expect(config.auth.jwt.secret).toBe("");
         },
         enabled: true,
         includeSecrets: false,
         includeFirstBoot: true,
      })(app).onBuilt?.();
      expect(called).toHaveBeenCalledTimes(2);
   });
});
