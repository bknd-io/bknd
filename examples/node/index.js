import { serve } from "bknd/adapter/node";

// Actually, all it takes is the following line:
// serve();

// this is optional, if omitted, it uses an in-memory database
/** @type {import("bknd/adapter/node").NodeBkndConfig} */
const config = {
   connection: {
      url: "file:data.db",
   },
   initialConfig: {
      media: {
         enabled: true,
         adapter: {
            type: "local",
            config: {
               path: "./uploads",
            },
         },
      },
   },
};

serve(config);
