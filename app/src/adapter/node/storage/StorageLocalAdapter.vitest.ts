import { describe } from "vitest";
import { viTestRunner } from "adapter/node/vitest";
import { StorageLocalAdapter } from "adapter/node";
import { adapterTestSuite } from "media/storage/adapters/adapter-test-suite";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("StorageLocalAdapter (node)", async () => {
   const basePath = path.resolve(import.meta.dirname, "../../../../__test__/_assets");
   const buffer = readFileSync(path.join(basePath, "image.png"));
   const file = new File([buffer], "image.png", { type: "image/png" });

   const adapter = new StorageLocalAdapter({
      path: path.join(basePath, "tmp"),
   });

   await adapterTestSuite(viTestRunner, adapter, file);
});
