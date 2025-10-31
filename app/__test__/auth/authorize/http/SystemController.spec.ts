import { describe, it, expect } from "bun:test";
import { SystemController } from "modules/server/SystemController";
import { createApp } from "core/test/utils";
import type { CreateAppConfig } from "App";
import { getPermissionRoutes } from "auth/middlewares/permission.middleware";

async function makeApp(config: Partial<CreateAppConfig> = {}) {
   const app = createApp(config);
   await app.build();
   return app;
}

describe.skip("SystemController", () => {
   it("...", async () => {
      const app = await makeApp();
      const controller = new SystemController(app);
      const hono = controller.getController();
      console.log(getPermissionRoutes(hono));
   });
});
