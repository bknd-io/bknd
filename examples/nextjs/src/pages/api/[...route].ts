import { config as bkndConfig } from "@/bknd";
import { serve } from "bknd/adapter/nextjs";

export const config = {
   runtime: "edge",
   // add a matcher for bknd dist to allow dynamic otherwise build may fail.
   // inside this repo it's '../../app/dist/index.js', outside probably inside node_modules
   // see https://github.com/vercel/next.js/issues/51401
   // and https://github.com/vercel/next.js/pull/69402
   unstable_allowDynamic: ["**/*.js"]
};

export default serve({
   cleanRequest: {
      searchParams: ["route"]
   },
   ...bkndConfig
});
