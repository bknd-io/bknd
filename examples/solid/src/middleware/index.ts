import { createMiddleware } from "@solidjs/start/middleware";
import config from "../../bknd.config";
import { serve } from "bknd/adapter/solid-start";

const handler = serve(config);

export default createMiddleware({
  onRequest: async (event) => {
    const url = new URL(event.request.url);
    const pathname = url.pathname;

    if (pathname.startsWith("/api") || pathname !== "/") {
      const res = await handler(event.request);

      if (res && res.status !== 404) {
        return res;
      }
    }
  },
});
