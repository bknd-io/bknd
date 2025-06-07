import { type D1Connection, serve } from "bknd/adapter/cloudflare";

export default serve({
   mode: "warm",
   d1: {
      session: true,
   },
   onBuilt: async (app) => {
      app.modules.server.get("/custom", async (c) => {
         const conn = c.var.app.em.connection as D1Connection;
         const res = await conn.client.prepare("select * from __bknd limit 1").all();
         return c.json({ hello: "world", res });
      });
   },
});
