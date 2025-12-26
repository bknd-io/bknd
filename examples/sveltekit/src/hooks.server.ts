import type { Handle } from "@sveltejs/kit";
import { serve } from "bknd/adapter/sveltekit";
import config from "../bknd.config";

const bkndHandler = serve(config);

export const handle: Handle = async ({ event, resolve }) => {
  // Handle bknd API requests
  if (event.url.pathname.startsWith("/api/")) {
    return bkndHandler(event);
  }

  return resolve(event);
};
