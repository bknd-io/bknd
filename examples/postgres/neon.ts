import { serve } from "bknd/adapter/bun";
import { createCustomPostgresConnection } from "bknd";
import { NeonDialect } from "kysely-neon";

const neon = createCustomPostgresConnection("neon", NeonDialect);

export default serve({
   connection: neon({
      connectionString: process.env.NEON,
   }),
   // ignore this, it's only required within this repository
   // because bknd is installed via "workspace:*"
   distPath: "../../app/dist",
});
