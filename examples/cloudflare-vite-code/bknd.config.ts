/**
 * This file gets automatically picked up by the bknd CLI. Since we're using cloudflare,
 * we want to use cloudflare bindings (such as the database). To do this, we need to wrap
 * the configuration with the `withPlatformProxy` helper function.
 *
 * Don't import this file directly in your app, otherwise "wrangler" will be bundled with your worker.
 * That's why we split the configuration into two files: `bknd.config.ts` and `config.ts`.
 */

import { withPlatformProxy } from "bknd/adapter/cloudflare/proxy";
import config from "./config.ts";

export default withPlatformProxy(config, {
   useProxy: true,
});
