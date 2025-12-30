import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import { StorageR2Adapter } from "./StorageR2Adapter";
import { adapterTestSuite } from "media/storage/adapters/adapter-test-suite";
import path from "node:path";
import { describe, afterAll, test, expect, beforeAll } from "vitest";
import { viTestRunner } from "adapter/node/vitest";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";

beforeAll(() => disableConsoleLog());
afterAll(() => enableConsoleLog());

let mf: Miniflare | undefined;
describe("StorageR2Adapter", async () => {
   mf = new Miniflare({
      modules: true,
      script: "export default { async fetch() { return new Response(null); } }",
      r2Buckets: ["BUCKET"],
   });
   const bucket = (await mf?.getR2Bucket("BUCKET")) as unknown as R2Bucket;

   test("test", () => {
      expect(bucket).toBeDefined();
   });
   const adapter = new StorageR2Adapter(bucket);

   const basePath = path.resolve(import.meta.dirname, "../../../../__test__/_assets");
   const buffer = readFileSync(path.join(basePath, "image.png"));
   const file = new File([buffer], "image.png", { type: "image/png" });

   // miniflare doesn't support range requests
   await adapterTestSuite(viTestRunner, adapter, file, { testRange: false });
});

afterAll(async () => {
   await mf?.dispose();
});
