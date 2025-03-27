import { retry, type TestRunner } from "core/test";
import type { StorageAdapter } from "media";
import { randomString } from "core/utils";
import type { BunFile } from "bun";

export async function adapterTestSuite(
   testRunner: TestRunner,
   adapter: StorageAdapter,
   file: File | BunFile,
   opts?: {
      retries?: number;
      retryTimeout?: number;
      skipExistsAfterDelete?: boolean;
   },
) {
   const { test, expect } = testRunner;
   const options = {
      retries: opts?.retries ?? 1,
      retryTimeout: opts?.retryTimeout ?? 1000,
   };

   let objects = 0;
   const _filename = randomString(10);
   const filename = `${_filename}.png`;

   await test("puts an object", async () => {
      objects = (await adapter.listObjects()).length;
      const result = await adapter.putObject(filename, file as unknown as File);
      expect(result).toBeDefined();
      const type = typeof result;
      expect(type).toBeOneOf(["string", "object"]);
      if (typeof result === "object") {
         expect(Object.keys(result).sort()).toEqual(["etag", "meta", "name"]);
         expect(result.meta.type).toBe(file.type);
      }
   });

   await test("lists objects", async () => {
      const length = await retry(
         () => adapter.listObjects().then((res) => res.length),
         (length) => length > objects,
         options.retries,
         options.retryTimeout,
      );

      expect(length).toBe(objects + 1);
   });

   await test("file exists", async () => {
      expect(await adapter.objectExists(filename)).toBe(true);
   });

   await test("gets an object", async () => {
      const res = await adapter.getObject(filename, new Headers());
      expect(res.ok).toBe(true);
      // @todo: check the content
   });

   await test("gets object meta", async () => {
      expect(await adapter.getObjectMeta(filename)).toEqual({
         type: file.type, // image/png
         size: file.size,
      });
   });

   await test("deletes an object", async () => {
      expect(await adapter.deleteObject(filename)).toBeUndefined();

      if (opts?.skipExistsAfterDelete !== true) {
         const exists = await retry(
            () => adapter.objectExists(filename),
            (res) => res === false,
            options.retries,
            options.retryTimeout,
         );
         expect(exists).toBe(false);
      }
   });
}
