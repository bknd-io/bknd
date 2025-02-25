import { describe, expect, test } from "bun:test";
import { randomString } from "../../../src/core/utils";
import { StorageLocalAdapter } from "../../../src/media/storage/adapters/StorageLocalAdapter";
import { assetsPath, assetsTmpPath } from "../../helper";

describe("StorageLocalAdapter", () => {
   const adapter = new StorageLocalAdapter({
      path: assetsTmpPath
   });

   const file = Bun.file(`${assetsPath}/image.png`);
   const _filename = randomString(10);
   const filename = `${_filename}.png`;

   let objects = 0;

   test("puts an object", async () => {
      objects = (await adapter.listObjects()).length;
      expect(await adapter.putObject(filename, file as unknown as File)).toBeString();
   });

   test("lists objects", async () => {
      expect((await adapter.listObjects()).length).toBe(objects + 1);
   });

   test("file exists", async () => {
      expect(await adapter.objectExists(filename)).toBeTrue();
   });

   test("gets an object", async () => {
      const res = await adapter.getObject(filename, new Headers());
      expect(res.ok).toBeTrue();
      // @todo: check the content
   });

   test("gets object meta", async () => {
      expect(await adapter.getObjectMeta(filename)).toEqual({
         type: file.type, // image/png
         size: file.size
      });
   });

   test("deletes an object", async () => {
      expect(await adapter.deleteObject(filename)).toBeUndefined();
      expect(await adapter.objectExists(filename)).toBeFalse();
   });
});
