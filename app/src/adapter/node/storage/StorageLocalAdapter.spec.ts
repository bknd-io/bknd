import { describe, test, expect } from "bun:test";
import { StorageLocalAdapter } from "./StorageLocalAdapter";
// @ts-ignore
import { assetsPath, assetsTmpPath } from "../../../../__test__/helper";
import { adapterTestSuite } from "media/storage/adapters/adapter-test-suite";
import { bunTestRunner } from "adapter/bun/test";

describe("StorageLocalAdapter (bun)", async () => {
   const adapter = new StorageLocalAdapter({
      path: assetsTmpPath,
   });

   const file = Bun.file(`${assetsPath}/image.png`);
   await adapterTestSuite(bunTestRunner, adapter, file);
});
