import { serve } from "bknd/adapter/cloudflare";
import config from "../../config.ts";

export default serve(config, () => ({
   // since bknd is running code-only, we can use a pre-initialized app instance if available
   warm: true,
}));
