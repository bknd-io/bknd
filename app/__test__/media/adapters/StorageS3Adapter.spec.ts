import { describe, expect, test } from "bun:test";
import { randomString } from "../../../src/core/utils";
import { StorageS3Adapter } from "../../../src/media";

import { config } from "dotenv";
const dotenvOutput = config({ path: `${import.meta.dir}/../../../.env` });
const { R2_ACCESS_KEY, R2_SECRET_ACCESS_KEY, R2_URL, AWS_ACCESS_KEY, AWS_SECRET_KEY, AWS_S3_URL } =
   dotenvOutput.parsed!;

// @todo: mock r2/s3 responses for faster tests
const ALL_TESTS = !!process.env.ALL_TESTS;
console.log("ALL_TESTS?", ALL_TESTS);

describe.skipIf(true)("StorageS3Adapter", async () => {
   if (ALL_TESTS) return;

   const versions = [
      [
         "r2",
         new StorageS3Adapter({
            access_key: R2_ACCESS_KEY as string,
            secret_access_key: R2_SECRET_ACCESS_KEY as string,
            url: R2_URL as string
         })
      ],
      [
         "s3",
         new StorageS3Adapter({
            access_key: AWS_ACCESS_KEY as string,
            secret_access_key: AWS_SECRET_KEY as string,
            url: AWS_S3_URL as string
         })
      ]
   ] as const;

   const _conf = {
      adapters: ["r2", "s3"],
      tests: [
         "listObjects",
         "putObject",
         "objectExists",
         "getObject",
         "deleteObject",
         "getObjectMeta"
      ]
   };

   const file = Bun.file(`${import.meta.dir}/icon.png`);
   const filename = `${randomString(10)}.png`;

   // single (dev)
   //_conf = { adapters: [/*"r2",*/ "s3"], tests: [/*"putObject",*/ "listObjects"] };

   function disabled(test: (typeof _conf.tests)[number]) {
      return !_conf.tests.includes(test);
   }

   // @todo: add mocked fetch for faster tests
   describe.each(versions)("StorageS3Adapter for %s", async (name, adapter) => {
      if (!_conf.adapters.includes(name) || ALL_TESTS) {
         console.log("Skipping", name);
         return;
      }

      let objects = 0;

      test.skipIf(disabled("putObject"))("puts an object", async () => {
         objects = (await adapter.listObjects()).length;
         expect(await adapter.putObject(filename, file)).toBeString();
      });

      test.skipIf(disabled("listObjects"))("lists objects", async () => {
         expect((await adapter.listObjects()).length).toBe(objects + 1);
      });

      test.skipIf(disabled("objectExists"))("file exists", async () => {
         expect(await adapter.objectExists(filename)).toBeTrue();
      });

      test.skipIf(disabled("getObject"))("gets an object", async () => {
         const res = await adapter.getObject(filename, new Headers());
         expect(res.ok).toBeTrue();
         // @todo: check the content
      });

      test.skipIf(disabled("getObjectMeta"))("gets object meta", async () => {
         expect(await adapter.getObjectMeta(filename)).toEqual({
            type: file.type, // image/png
            size: file.size
         });
      });

      test.skipIf(disabled("deleteObject"))("deletes an object", async () => {
         expect(await adapter.deleteObject(filename)).toBeUndefined();
         expect(await adapter.objectExists(filename)).toBeFalse();
      });
   });
});
