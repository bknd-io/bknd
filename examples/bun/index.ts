import { type BunBkndConfig, serve } from "bknd/adapter/bun";

// Actually, all it takes is the following line:
// serve();

// this is optional, if omitted, it uses an in-memory database
const config: BunBkndConfig = {
   connection: {
      url: "file:data.db",
   },
};

serve(config);
