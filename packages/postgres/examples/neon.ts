import { serve } from "bknd/adapter/bun";
import { createCustomPostgresConnection } from "../src";
import { NeonDialect } from "kysely-neon";

const neon = createCustomPostgresConnection(NeonDialect);

export default serve({
   connection: neon({
      connectionString: process.env.NEON,
   }),
   // ignore this, it's only required within this repository
   // because bknd is installed via "workspace:*"
   distPath: "../../app/dist",
});
