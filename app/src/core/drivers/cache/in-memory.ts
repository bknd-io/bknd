import type { ICacheDriver } from "./index";

interface InMemoryCacheOptions {
   // maximum total size in bytes for all keys and values
   maxSize?: number;
   // default time-to-live in seconds
   defaultTTL?: number;
}

interface CacheEntry {
   value: string;
   // timestamp in ms, or null for no expiry
   expiresAt: number | null;
   // size in bytes of this entry (key + value)
   size: number;
}

function byteLength(str: string): number {
   return new TextEncoder().encode(str).length;
}

export class InMemoryCacheDriver implements ICacheDriver {
   protected cache: Map<string, CacheEntry>;
   protected maxSize: number;
   protected defaultTTL: number;
   protected currentSize: number;

   constructor(options: InMemoryCacheOptions = {}) {
      this.maxSize = options.maxSize ?? 1024 * 1024 * 10; // 10MB default
      this.defaultTTL = options.defaultTTL ?? 60 * 60; // 1 hour default
      this.cache = new Map();
      this.currentSize = 0;
   }

   protected now(): number {
      return Date.now();
   }

   protected isExpired(entry: CacheEntry): boolean {
      return entry.expiresAt !== null && entry.expiresAt <= this.now();
   }

   protected setEntry(key: string, entry: CacheEntry) {
      const oldEntry = this.cache.get(key);
      const oldSize = oldEntry ? oldEntry.size : 0;
      let projectedSize = this.currentSize - oldSize + entry.size;

      // if the entry itself is too large, throw
      if (entry.size > this.maxSize) {
         throw new Error(
            `InMemoryCacheDriver: entry too large (entry: ${entry.size}, max: ${this.maxSize})`,
         );
      }

      // evict LRU until it fits
      while (projectedSize > this.maxSize && this.cache.size > 0) {
         // remove least recently used (first inserted)
         const lruKey = this.cache.keys().next().value;
         if (typeof lruKey === "string") {
            const lruEntry = this.cache.get(lruKey);
            if (lruEntry) {
               this.currentSize -= lruEntry.size;
            }
            this.cache.delete(lruKey);
            projectedSize = this.currentSize - oldSize + entry.size;
         } else {
            break;
         }
      }

      if (projectedSize > this.maxSize) {
         throw new Error(
            `InMemoryCacheDriver: maxSize exceeded after eviction (attempted: ${projectedSize}, max: ${this.maxSize})`,
         );
      }

      if (oldEntry) {
         this.currentSize -= oldSize;
      }
      this.cache.delete(key); // Remove to update order (for LRU)
      this.cache.set(key, entry);
      this.currentSize += entry.size;
   }

   async get(key: string): Promise<string | undefined> {
      const entry = this.cache.get(key);
      if (!entry) return;
      if (this.isExpired(entry)) {
         this.cache.delete(key);
         this.currentSize -= entry.size;
         return;
      }
      // mark as recently used
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry.value;
   }

   async set(key: string, value: string, ttl?: number): Promise<void> {
      const expiresAt =
         ttl === undefined
            ? this.defaultTTL > 0
               ? this.now() + this.defaultTTL * 1000
               : null
            : ttl > 0
              ? this.now() + ttl * 1000
              : null;
      const size = byteLength(key) + byteLength(value);
      this.setEntry(key, { value, expiresAt, size });
   }

   async del(key: string): Promise<void> {
      const entry = this.cache.get(key);
      if (entry) {
         this.currentSize -= entry.size;
         this.cache.delete(key);
      }
   }
}

export const memoryCache = (options?: InMemoryCacheOptions) => {
   return new InMemoryCacheDriver(options);
};
