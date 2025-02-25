import { describe, expect, test } from "bun:test";
import { randomString } from "../../../src/core/utils";
import { StorageCloudinaryAdapter } from "../../../src/media";

import { config } from "dotenv";
const dotenvOutput = config({ path: `${import.meta.dir}/../../../.env` });
const {
   CLOUDINARY_CLOUD_NAME,
   CLOUDINARY_API_KEY,
   CLOUDINARY_API_SECRET,
   CLOUDINARY_UPLOAD_PRESET
} = dotenvOutput.parsed!;

const ALL_TESTS = !!process.env.ALL_TESTS;

describe.skipIf(ALL_TESTS)("StorageCloudinaryAdapter", () => {
   if (ALL_TESTS) return;

   const adapter = new StorageCloudinaryAdapter({
      cloud_name: CLOUDINARY_CLOUD_NAME as string,
      api_key: CLOUDINARY_API_KEY as string,
      api_secret: CLOUDINARY_API_SECRET as string,
      upload_preset: CLOUDINARY_UPLOAD_PRESET as string
   });

   const file = Bun.file(`${import.meta.dir}/icon.png`);
   const _filename = randomString(10);
   const filename = `${_filename}.png`;

   test("object exists", async () => {
      expect(await adapter.objectExists("7fCTBi6L8c.png")).toBeTrue();
      process.exit();
   });

   test("puts object", async () => {
      expect(await adapter.objectExists(filename)).toBeFalse();

      const result = await adapter.putObject(filename, file);
      console.log("result", result);
      expect(result).toBeDefined();
      expect(result?.name).toBe(filename);
   });

   test("object exists", async () => {
      await Bun.sleep(10000);
      const one = await adapter.objectExists(_filename);
      const two = await adapter.objectExists(filename);
      expect(await adapter.objectExists(filename)).toBeTrue();
   });

   test("object meta", async () => {
      const result = await adapter.getObjectMeta(filename);
      console.log("objectMeta:result", result);
      expect(result).toBeDefined();
      expect(result.type).toBe("image/png");
      expect(result.size).toBeGreaterThan(0);
   });

   test("list objects", async () => {
      const result = await adapter.listObjects();
      console.log("listObjects:result", result);
   });
});
