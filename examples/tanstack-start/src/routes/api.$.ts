import { createFileRoute } from "@tanstack/react-router";
import config from "../../bknd.config";
import { serve } from "bknd/adapter/tanstack-start";

const handler = serve(config);

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      ANY: async ({ request }) => await handler(request),
    },
  },
});
