import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { StorageS3Adapter } from "./StorageS3Adapter";

import { config } from "dotenv";
import { adapterTestSuite } from "media";
import { assetsPath } from "../../../../../__test__/helper";
//import { enableFetchLogging } from "../../helper";
const dotenvOutput = config({ path: `${import.meta.dir}/.env` });
const { R2_ACCESS_KEY, R2_SECRET_ACCESS_KEY, R2_URL, AWS_ACCESS_KEY, AWS_SECRET_KEY, AWS_S3_URL } =
   dotenvOutput.parsed!;

const ALL_TESTS = !!process.env.ALL_TESTS;

/* 
// @todo: preparation to mock s3 calls + replace fast-xml-parser
let cleanup: () => void;
beforeAll(async () => {
   cleanup = await enableFetchLogging();
});
afterAll(() => {
   cleanup();
}); */

describe.skipIf(ALL_TESTS)("StorageS3Adapter", async () => {
   if (ALL_TESTS) return;

   const versions = [
      [
         "r2",
         new StorageS3Adapter({
            access_key: R2_ACCESS_KEY as string,
            secret_access_key: R2_SECRET_ACCESS_KEY as string,
            url: R2_URL as string,
         }),
      ],
      [
         "s3",
         new StorageS3Adapter({
            access_key: AWS_ACCESS_KEY as string,
            secret_access_key: AWS_SECRET_KEY as string,
            url: AWS_S3_URL as string,
         }),
      ],
   ] as const;
   const file = Bun.file(`${assetsPath}/image.png`) as unknown as File;

   describe.each(versions)("%s", async (_name, adapter) => {
      await adapterTestSuite({ test, expect }, adapter, file);
   });
});
