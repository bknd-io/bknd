import { createRuntimeApp } from "bknd/adapter";

const app = await createRuntimeApp({
   connection: {
      url: "file:./data.db",
   },
   adminOptions: {
      // currently needs a hosted version of the static assets
      assetsPath: "https://cdn.bknd.io/bknd/static/0.15.0-rc.9/",
   },
});

// @ts-ignore
Deno.serve(app.fetch);
