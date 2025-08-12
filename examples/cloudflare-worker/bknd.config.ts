/**
 * Optionally wrapping the configuration with the `withPlatformProxy` function
 * enables programmatic access to the bindings, e.g. for generating types.
 */

import { withPlatformProxy } from "bknd/adapter/cloudflare";

export default withPlatformProxy({
   d1: {
      session: true,
   },
});
