import { serve } from "bknd/adapter/cloudflare";

export default serve({
   mode: "fresh",
   d1: {
      session: true,
   },
});
