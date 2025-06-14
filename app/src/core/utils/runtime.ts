import { getRuntimeKey as honoGetRuntimeKey } from "hono/adapter";

/**
 * Adds additional checks for nextjs
 */
export function getRuntimeKey(): string {
   const global = globalThis as any;

   // Detect Next.js server-side runtime
   if (global?.process?.env?.NEXT_RUNTIME === "nodejs") {
      return "nextjs";
   }

   // Detect Next.js edge runtime
   if (global?.process?.env?.NEXT_RUNTIME === "edge") {
      return "nextjs-edge";
   }

   // Detect Next.js client-side runtime
   // @ts-ignore
   if (typeof window !== "undefined" && window.__NEXT_DATA__) {
      return "nextjs-client";
   }

   return honoGetRuntimeKey();
}

const features = {
   // supports the redirect of not full qualified addresses
   // not supported in nextjs
   redirects_non_fq: true,
};

export function runtimeSupports(feature: keyof typeof features) {
   const runtime = getRuntimeKey();
   if (runtime.startsWith("nextjs")) {
      features.redirects_non_fq = false;
   }

   return features[feature];
}

export function isNode() {
   try {
      return global?.process?.release?.name === "node";
   } catch (e) {
      return false;
   }
}

export function isBun() {
   try {
      return typeof Bun !== "undefined";
   } catch (e) {
      return false;
   }
}

export function invariant(condition: boolean | any, message: string) {
   if (!condition) {
      throw new Error(message);
   }
}
