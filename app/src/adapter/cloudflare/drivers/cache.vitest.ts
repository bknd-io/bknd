import { describe, vi, afterAll, beforeAll } from "vitest";
import { cacheWorkersKV } from "./cache";
import { viTestRunner } from "adapter/node/vitest";
import { cacheDriverTestSuite } from "core/drivers/cache/cache-driver-test-suite";
import { Miniflare } from "miniflare";

describe("cacheWorkersKV", async () => {
   beforeAll(() => {
      vi.useFakeTimers();
   });
   afterAll(() => {
      vi.restoreAllMocks();
   });

   const mf = new Miniflare({
      modules: true,
      script: "export default { async fetch() { return new Response(null); } }",
      kvNamespaces: ["KV"],
   });

   const kv = (await mf.getKVNamespace("KV")) as unknown as KVNamespace;

   cacheDriverTestSuite(viTestRunner, {
      makeCache: () => cacheWorkersKV(kv),
      setTime: (ms: number) => {
         vi.advanceTimersByTime(ms);
      },
      options: {
         minTTL: 60,
         // doesn't work with miniflare
         skipTTL: true,
      },
   });
});
