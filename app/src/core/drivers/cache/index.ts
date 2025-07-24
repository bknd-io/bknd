/**
 * Interface for cache driver implementations
 * Defines standard methods for interacting with a cache storage system
 */
export interface ICacheDriver {
   /**
    * Retrieves a value from the cache by its key
    *
    * @param key unique identifier for the cached value
    * @returns resolves to the cached string value or undefined if not found
    */
   get(key: string): Promise<string | undefined>;

   /**
    * Stores a value in the cache with an optional time-to-live
    *
    * @param key unique identifier for storing the value
    * @param value string value to cache
    * @param ttl optional time-to-live in seconds before the value expires
    * @throws if the value cannot be stored
    */
   set(key: string, value: string, ttl?: number): Promise<void>;

   /**
    * Removes a value from the cache
    *
    * @param key unique identifier of the value to delete
    */
   del(key: string): Promise<void>;
}

export { cacheDriverTestSuite } from "./cache-driver-test-suite";
