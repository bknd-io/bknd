import { cacheDriverTestSuite } from "./cache-driver-test-suite";
import { memoryCache } from "./in-memory";
import { bunTestRunner } from "adapter/bun/test";
import { setSystemTime, afterAll, beforeAll, test, expect, describe } from "bun:test";

let baseTime = Date.now();

beforeAll(() => {
   baseTime = Date.now();
   setSystemTime(new Date(baseTime));
});

afterAll(() => {
   setSystemTime(); // Reset to real time
});

describe("InMemoryCacheDriver", () => {
   cacheDriverTestSuite(bunTestRunner, {
      makeCache: () => memoryCache(),
      setTime: (ms: number) => {
         setSystemTime(new Date(baseTime + ms));
      },
   });

   test("evicts least recently used entries by byte size", async () => {
      // maxSize = 20 bytes for this test
      const cache = memoryCache({ maxSize: 20 });
      // each key and value is 1 char = 1 byte (ASCII)
      // totals to 2 bytes each
      await cache.set("a", "1");
      await cache.set("b", "2");
      await cache.set("c", "3");
      await cache.set("d", "4");
      await cache.set("e", "5");
      // total: 10 bytes
      // now add a large value to force eviction
      await cache.set("big", "1234567890");
      // should evict least recently used entries until it fits
      // only "big" and possibly one other small entry should remain
      expect(await cache.get("big")).toBe("1234567890");
      // the oldest keys should be evicted
      expect(await cache.get("a")).toBeUndefined();
      expect(await cache.get("b")).toBeUndefined();
      // the most recent small keys may or may not remain depending on eviction order
   });

   test("throws if entry is too large to ever fit", async () => {
      const cache = memoryCache({ maxSize: 5 });
      // key: 3, value: 10 = 13 bytes
      expect(cache.set("big", "1234567890")).rejects.toThrow();
   });
});
