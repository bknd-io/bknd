import { describe, expect, test } from "bun:test";
import { StorageCloudinaryAdapter } from "./StorageCloudinaryAdapter";
import { config } from "dotenv";
// @ts-ignore
import { assetsPath, assetsTmpPath } from "../../../../../__test__/helper";
import { adapterTestSuite } from "media/storage/adapters/adapter-test-suite";

const dotenvOutput = config({ path: `${import.meta.dir}/.env` });
const {
   CLOUDINARY_CLOUD_NAME,
   CLOUDINARY_API_KEY,
   CLOUDINARY_API_SECRET,
   CLOUDINARY_UPLOAD_PRESET,
} = dotenvOutput.parsed!;

const ALL_TESTS = !!process.env.ALL_TESTS;

describe.skipIf(ALL_TESTS)("StorageCloudinaryAdapter", async () => {
   if (ALL_TESTS) return;

   const adapter = new StorageCloudinaryAdapter({
      cloud_name: CLOUDINARY_CLOUD_NAME as string,
      api_key: CLOUDINARY_API_KEY as string,
      api_secret: CLOUDINARY_API_SECRET as string,
      upload_preset: CLOUDINARY_UPLOAD_PRESET as string,
   });

   const file = Bun.file(`${assetsPath}/image.png`) as unknown as File;

   test("hash", async () => {
      expect(
         await adapter.generateSignature(
            {
               eager: "w_400,h_300,c_pad|w_260,h_200,c_crop",
               public_id: "sample_image",
               timestamp: 1315060510,
            },
            "abcd",
         ),
      ).toEqual({
         signature: "bfd09f95f331f558cbd1320e67aa8d488770583e",
         timestamp: 1315060510,
      });
   });

   await adapterTestSuite({ test, expect }, adapter, file, {
      // eventual consistency
      retries: 20,
      retryTimeout: 1000,
      // result is cached from cloudinary
      skipExistsAfterDelete: true,
   });
});
