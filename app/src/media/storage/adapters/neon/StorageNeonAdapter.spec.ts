import { describe, expect, test } from "bun:test";
import { getNeonRegion, StorageNeonAdapter } from "./StorageNeonAdapter";

import { config } from "dotenv";
import { adapterTestSuite } from "media/storage/adapters/adapter-test-suite";
import { assetsPath } from "../../../../../__test__/helper";
import { bunTestRunner } from "adapter/bun/test";
config({ path: `${import.meta.dir}/.env` });
const {
   NEON_STORAGE_ACCESS_KEY_ID,
   NEON_STORAGE_SECRET_ACCESS_KEY,
   NEON_STORAGE_ENDPOINT,
   NEON_STORAGE_BUCKET,
} = process.env;

const ALL_TESTS = !!process.env.ALL_TESTS;
const endpoint = "https://br-cool-darkness-a1b2c3d4.storage.c-6.us-east-2.aws.neon.tech";

describe("StorageNeonAdapter", () => {
   test("derives the region from the endpoint", () => {
      expect(getNeonRegion(endpoint)).toBe("us-east-2");
      expect(getNeonRegion("https://br-x.storage.c-1.ap-southeast-1.aws.neon.tech")).toBe(
         "ap-southeast-1",
      );
      expect(getNeonRegion("https://localhost:9000")).toBeUndefined();
   });

   test("signs with the branch's region and uses path-style urls", () => {
      const adapter = new StorageNeonAdapter({
         access_key: "nak_live_x",
         secret_access_key: "nsk_live_x",
         endpoint,
         bucket: "media",
      });
      expect(adapter.getName()).toBe("neon");
      expect(adapter.client.service).toBe("s3");
      expect(adapter.client.region).toBe("us-east-2");
      expect(adapter.getObjectUrl("image.png")).toBe(`${endpoint}/media/image.png`);
   });

   test("prefers an explicit region", () => {
      const adapter = new StorageNeonAdapter({
         access_key: "",
         secret_access_key: "",
         endpoint: "https://localhost:9000",
         bucket: "media",
         region: "eu-central-1",
      });
      expect(adapter.client.region).toBe("eu-central-1");
   });

   test("leaves the region to the client if it can't be derived", () => {
      const adapter = new StorageNeonAdapter({
         access_key: "",
         secret_access_key: "",
         endpoint: "https://localhost:9000",
         bucket: "media",
      });
      expect(adapter.client.region).toBeUndefined();
      expect(adapter.getObjectUrl("image.png")).toBe("https://localhost:9000/media/image.png");
   });

   test("serializes its own config", () => {
      const config = {
         access_key: "nak_live_x",
         secret_access_key: "nsk_live_x",
         endpoint,
         bucket: "media",
      };
      const adapter = new StorageNeonAdapter(config);
      expect(adapter.toJSON()).toEqual({ type: "neon", config: undefined });
      expect(adapter.toJSON(true)).toEqual({ type: "neon", config });
   });
});

describe.skipIf(ALL_TESTS || !NEON_STORAGE_ENDPOINT)("StorageNeonAdapter (live)", async () => {
   if (ALL_TESTS || !NEON_STORAGE_ENDPOINT) return;

   const adapter = new StorageNeonAdapter({
      access_key: NEON_STORAGE_ACCESS_KEY_ID as string,
      secret_access_key: NEON_STORAGE_SECRET_ACCESS_KEY as string,
      endpoint: NEON_STORAGE_ENDPOINT as string,
      bucket: NEON_STORAGE_BUCKET as string,
   });
   const file = Bun.file(`${assetsPath}/image.png`) as unknown as File;

   // the S3 adapter doesn't forward range headers yet
   await adapterTestSuite(bunTestRunner, adapter, file, { testRange: false });
});
