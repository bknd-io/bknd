import type { Handle } from "@sveltejs/kit";
import { serve } from "bknd/adapter/sveltekit";
import { env } from "$env/dynamic/private";
import config from "../bknd.config";

const bkndHandler = serve(config, env);

export const handle: Handle = async ({ event, resolve }) => {
  // Handle bknd API requests
  if (event.url.pathname.startsWith("/api/")) {
    return bkndHandler(event);
  }

  return resolve(event);
};
