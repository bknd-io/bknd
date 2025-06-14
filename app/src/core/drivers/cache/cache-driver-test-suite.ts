import type { TestRunner } from "core/test";
import type { ICacheDriver } from "./index";

export function cacheDriverTestSuite(
   testRunner: TestRunner,
   {
      makeCache,
      setTime,
      options,
   }: {
      makeCache: () => ICacheDriver;
      setTime: (ms: number) => void;
      options?: {
         minTTL?: number;
         skipTTL?: boolean;
      };
   },
) {
   const { test, expect } = testRunner;
   const minTTL = options?.minTTL ?? 0;

   test("get within ttl", async () => {
      const cache = makeCache();
      await cache.set("ttl", "bar", minTTL + 2); // 2 second TTL
      setTime(minTTL * 1000 + 1000); // advance by 1 second
      expect(await cache.get("ttl")).toBe("bar");
   });

   test("set and get returns value", async () => {
      const cache = makeCache();
      await cache.set("value", "bar");
      expect(await cache.get("value")).toBe("bar");
   });

   test("get returns undefined for missing key", async () => {
      const cache = makeCache();
      expect(await cache.get("missing" + Math.random())).toBeUndefined();
   });

   test("delete removes value", async () => {
      const cache = makeCache();
      await cache.set("delete", "bar");
      await cache.del("delete");
      expect(await cache.get("delete")).toBeUndefined();
   });

   test("set overwrites value", async () => {
      const cache = makeCache();
      await cache.set("overwrite", "bar");
      await cache.set("overwrite", "baz");
      expect(await cache.get("overwrite")).toBe("baz");
   });

   test("set with ttl expires", async () => {
      const cache = makeCache();
      await cache.set("expire", "bar", minTTL + 1); // 1 second TTL
      expect(await cache.get("expire")).toBe("bar");
      // advance time
      setTime(minTTL * 1000 * 2000);
      if (options?.skipTTL) {
         await cache.del("expire");
      }
      expect(await cache.get("expire")).toBeUndefined();
   });
   test("set without ttl does not expire", async () => {
      const cache = makeCache();
      await cache.set("ttl0", "bar");
      expect(await cache.get("ttl0")).toBe("bar");
      setTime(1000);
      expect(await cache.get("ttl0")).toBe("bar");
   });
}
