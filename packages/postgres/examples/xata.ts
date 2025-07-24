import { serve } from "bknd/adapter/bun";
import { createCustomPostgresConnection } from "../src";
import { XataDialect } from "@xata.io/kysely";
import { buildClient } from "@xata.io/client";

const client = buildClient();
const xata = new client({
   databaseURL: process.env.XATA_URL,
   apiKey: process.env.XATA_API_KEY,
   branch: process.env.XATA_BRANCH,
});

const connection = createCustomPostgresConnection(XataDialect, {
   supports: {
      batching: false,
   },
})({ xata });

export default serve({
   connection,
   // ignore this, it's only required within this repository
   // because bknd is installed via "workspace:*"
   distPath: "../../../app/dist",
});
