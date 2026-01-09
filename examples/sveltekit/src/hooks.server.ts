import type { Handle } from "@sveltejs/kit";
import { serve } from "bknd/adapter/sveltekit";
import { env } from "$env/dynamic/private";
import config from "../bknd.config";

const bkndHandler = serve(config, env);

export const handle: Handle = async ({ event, resolve }) => {
  // Handle bknd API requests
  const pathname = event.url.pathname;
  if (pathname.startsWith("/api/") || pathname.startsWith("/admin")) {
    const res = await bkndHandler(event);
    if (res.status !== 404) {
      return res;
    }
  }

  return resolve(event);
};
