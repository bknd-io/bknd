import type { ICacheDriver } from "core/drivers";

interface WorkersKVCacheOptions {
   // default time-to-live in seconds
   defaultTTL?: number;
   // prefix for the cache key
   cachePrefix?: string;
}

export class WorkersKVCacheDriver implements ICacheDriver {
   protected readonly kv: KVNamespace;
   protected readonly defaultTTL?: number;
   protected readonly cachePrefix: string;

   constructor(kv: KVNamespace, options: WorkersKVCacheOptions = {}) {
      this.kv = kv;
      this.cachePrefix = options.cachePrefix ?? "";
      this.defaultTTL = options.defaultTTL;
   }

   protected getKey(key: string): string {
      return this.cachePrefix + key;
   }

   async get(key: string): Promise<string | undefined> {
      const value = await this.kv.get(this.getKey(key));
      return value === null ? undefined : value;
   }

   async set(key: string, value: string, ttl?: number): Promise<void> {
      let expirationTtl = ttl ?? this.defaultTTL;
      if (expirationTtl) {
         expirationTtl = Math.max(expirationTtl, 60);
      }
      await this.kv.put(this.getKey(key), value, { expirationTtl: expirationTtl });
   }

   async del(key: string): Promise<void> {
      await this.kv.delete(this.getKey(key));
   }
}

export const cacheWorkersKV = (kv: KVNamespace, options?: WorkersKVCacheOptions) => {
   return new WorkersKVCacheDriver(kv, options);
};
