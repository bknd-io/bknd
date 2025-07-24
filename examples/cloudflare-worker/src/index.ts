import { serve } from "bknd/adapter/cloudflare";

export default serve({
   mode: "warm",
   d1: {
      session: true,
   },
});
