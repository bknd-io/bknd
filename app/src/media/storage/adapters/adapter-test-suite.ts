import { retry, type TestRunner } from "core/test";
import type { StorageAdapter } from "media/storage/StorageAdapter";
import { randomString } from "bknd/utils";
import type { BunFile } from "bun";

export async function adapterTestSuite(
   testRunner: TestRunner,
   _adapter: StorageAdapter | (() => StorageAdapter),
   file: File | BunFile,
   opts?: {
      retries?: number;
      retryTimeout?: number;
      skipExistsAfterDelete?: boolean;
      testRange?: boolean;
   },
) {
   const { test, expect } = testRunner;
   const options = {
      retries: opts?.retries ?? 1,
      retryTimeout: opts?.retryTimeout ?? 1000,
      testRange: opts?.testRange ?? true,
   };

   let objects = 0;
   const _filename = randomString(10);
   const filename = `${_filename}.png`;

   const getAdapter = (
      typeof _adapter === "function" ? _adapter : () => _adapter
   ) as () => StorageAdapter;

   await test("puts an object", async () => {
      const adapter = getAdapter();
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
      const adapter = getAdapter();
      const length = await retry(
         () => adapter.listObjects().then((res) => res.length),
         (length) => length > objects,
         options.retries,
         options.retryTimeout,
      );

      expect(length).toBe(objects + 1);
   });

   await test("file exists", async () => {
      const adapter = getAdapter();
      expect(await adapter.objectExists(filename)).toBe(true);
   });

   await test("gets an object", async () => {
      const adapter = getAdapter();
      const res = await adapter.getObject(filename, new Headers());
      expect(res.ok).toBe(true);
      expect(res.headers.get("Accept-Ranges")).toBe("bytes");
      // @todo: check the content
   });

   if (options.testRange) {
      await test("handles range request - partial content", async () => {
         const headers = new Headers({ Range: "bytes=0-99" });
         const adapter = getAdapter();
         const res = await adapter.getObject(filename, headers);
         expect(res.status).toBe(206); // Partial Content
         expect(/^bytes 0-99\/\d+$/.test(res.headers.get("Content-Range")!)).toBe(true);
         expect(res.headers.get("Accept-Ranges")).toBe("bytes");
      });

      await test("handles range request - suffix range", async () => {
         const headers = new Headers({ Range: "bytes=-100" });
         const adapter = getAdapter();
         const res = await adapter.getObject(filename, headers);
         expect(res.status).toBe(206); // Partial Content
         expect(/^bytes \d+-\d+\/\d+$/.test(res.headers.get("Content-Range")!)).toBe(true);
      });

      await test("handles invalid range request", async () => {
         const headers = new Headers({ Range: "bytes=invalid" });
         const adapter = getAdapter();
         const res = await adapter.getObject(filename, headers);
         expect(res.status).toBe(416); // Range Not Satisfiable
         expect(/^bytes \*\/\d+$/.test(res.headers.get("Content-Range")!)).toBe(true);
      });
   }

   await test("gets object meta", async () => {
      const adapter = getAdapter();
      expect(await adapter.getObjectMeta(filename)).toEqual({
         type: file.type, // image/png
         size: file.size,
      });
   });

   await test("deletes an object", async () => {
      const adapter = getAdapter();
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
