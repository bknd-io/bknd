import { describe, beforeAll, vi, afterAll, spyOn } from "bun:test";
import { OpfsStorageAdapter } from "./OpfsStorageAdapter";
// @ts-ignore
import { assetsPath } from "../../../__test__/helper";
import { adapterTestSuite } from "media/storage/adapters/adapter-test-suite";
import { bunTestRunner } from "adapter/bun/test";
import { MockFileSystemDirectoryHandle } from "adapter/browser/mock";

describe("OpfsStorageAdapter", async () => {
   let mockRoot: MockFileSystemDirectoryHandle;
   let testSuiteAdapter: OpfsStorageAdapter;

   const _mock = spyOn(global, "navigator");

   beforeAll(() => {
      // mock navigator.storage.getDirectory()
      mockRoot = new MockFileSystemDirectoryHandle("opfs-root");
      const mockNavigator = {
         storage: {
            getDirectory: vi.fn().mockResolvedValue(mockRoot),
         },
      };
      // @ts-ignore
      _mock.mockReturnValue(mockNavigator);
      testSuiteAdapter = new OpfsStorageAdapter();
   });

   afterAll(() => {
      _mock.mockRestore();
   });

   const file = Bun.file(`${assetsPath}/image.png`);
   await adapterTestSuite(bunTestRunner, () => testSuiteAdapter, file);
});
