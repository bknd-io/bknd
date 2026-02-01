import { Hono } from "hono";
import type { ServerEnv } from "bknd";

/**
 * Add custom routes to the API here. Base path is `/api`.
 */
export default new Hono<ServerEnv>().get("/", (c) => {
   // const app = c.var.app;
   // const api = app.getApi();
   return c.json({ message: "Hello, world!" });
});
