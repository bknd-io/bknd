import { PostHog } from "posthog-js-lite";
import { getVersion } from "cli/utils/sys";
import { env, isDebug } from "bknd";
import { $console } from "bknd/utils";

type Properties = { [p: string]: any };

let posthog: PostHog | null = null;
let version: string | null = null;

const is_debug = isDebug() || !!process.env.LOCAL;
const enabled = env("cli_telemetry", !is_debug);

export async function init(): Promise<boolean> {
   try {
      if (!enabled) {
         $console.debug("telemetry disabled");
         return false;
      }

      $console.debug("init telemetry");
      if (!posthog) {
         posthog = new PostHog(process.env.PUBLIC_POSTHOG_KEY!, {
            host: process.env.PUBLIC_POSTHOG_HOST!,
            disabled: !enabled,
         });
      }
      version = await getVersion();
      return true;
   } catch (e) {
      $console.debug("failed to initialize telemetry", e);
   }

   return false;
}

export function client(): PostHog {
   if (!posthog) {
      throw new Error("PostHog client not initialized. Call init() first.");
   }

   return posthog;
}

export function capture(event: string, properties: Properties = {}): void {
   try {
      if (!enabled) return;

      const name = `cli_${event}`;
      const props = {
         ...properties,
         version: version!,
      };
      $console.debug(`capture "${name}"`, props);
      client().capture(name, props);
   } catch (e) {
      $console.debug("failed to capture telemetry", e);
   }
}

export function createScoped(scope: string, p: Properties = {}) {
   const properties = p;
   const _capture = (event: string, props: Properties = {}) => {
      return capture(`${scope}_${event}`, { ...properties, ...props });
   };
   return { capture: _capture, properties };
}

export async function flush() {
   try {
      if (!enabled) return;

      $console.debug("flush telemetry");
      if (posthog) {
         await posthog.flush();
      }
   } catch (e) {
      $console.debug("failed to flush telemetry", e);
   }
}
