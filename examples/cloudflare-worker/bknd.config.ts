/**
 * Optionally wrapping the configuration with the `withPlatformProxy` function
 * enables programmatic access to the bindings, e.g. for generating types.
 *
 * We're using separate files, so that "wrangler" doesn't get bundled with your worker.
 */

import { withPlatformProxy } from "bknd/adapter/cloudflare/proxy";
import config from "./config.ts";

export default withPlatformProxy(config);
