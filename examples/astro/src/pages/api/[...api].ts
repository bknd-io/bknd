import type { APIContext } from "astro";
import { serve } from "bknd/adapter/astro";
import { config } from "../../bknd";

export const prerender = false;
export const ALL = serve<APIContext>(config);
