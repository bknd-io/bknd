import { describe, expect, test } from "bun:test";
import * as large from "../../src/media/storage/mime-types";
import * as tiny from "../../src/media/storage/mime-types-tiny";
import { getRandomizedFilename } from "../../src/media/utils";

describe("media/mime-types", () => {
   test("tiny resolves", () => {
      const tests = [
         [".mp4", "video/mp4", ".jpg", "image/jpeg", ".zip", "application/zip"],
      ] as const;

      for (const [ext, mime] of tests) {
         expect(tiny.guess(ext)).toBe(mime);
      }
   });

   test("all tiny resolves to large", () => {
      for (const [ext, mime] of Object.entries(tiny.M)) {
         expect(large.guessMimeType("." + ext)).toBe(mime);
      }

      for (const [type, exts] of Object.entries(tiny.Q)) {
         for (const ext of exts) {
            const ex = `${type}/${ext}`;
            try {
               expect(large.guessMimeType("." + ext)).toBe(ex);
            } catch (e) {
               console.log(`Failed for ${ext}`, {
                  type,
                  exts,
                  ext,
                  expected: ex,
                  actual: large.guessMimeType("." + ext),
               });
               throw new Error(`Failed for ${ext}`);
            }
         }
      }
   });

   test("isMimeType", () => {
      const tests = [
         ["image/avif", true],
         ["image/AVIF", true],
         ["image/jpeg", true],
         ["image/jpeg", true, ["image/png"]],
         ["image/png", false, ["image/png"]],
         ["image/png", true],
         ["image/heif", true],
         ["image/heic", true],
         ["image/gif", true],
         ["whatever", false],
         ["text/tab-separated-values", true],
         ["application/zip", true],
      ];

      for (const [mime, expected, exclude] of tests) {
         expect(
            tiny.isMimeType(mime, exclude as any),
            `isMimeType(): ${mime} should be ${expected}`,
         ).toBe(expected as any);
      }
   });

   test("extension", () => {
      const tests = [
         ["image/avif", "avif"],
         ["image/png", "png"],
         ["image/PNG", "png"],
         ["image/jpeg", "jpeg"],
         ["application/zip", "zip"],
         ["text/tab-separated-values", "tsv"],
         ["application/zip", "zip"],
      ] as const;

      for (const [mime, ext] of tests) {
         expect(tiny.extension(mime), `extension(): ${mime} should be ${ext}`).toBe(ext);
      }
   });

   test("getRandomizedFilename", () => {
      const tests = [
         ["file.txt", "txt"],
         ["file.TXT", "txt"],
         ["image.jpg", "jpg"],
         ["image.avif", "avif"],
         ["image.heic", "heic"],
         ["image.jpeg", "jpeg"],
         ["-473Wx593H-466453554-black-MODEL.jpg", "jpg"],
         ["-473Wx593H-466453554-black-MODEL.avif", "avif"],
      ] as const;

      for (const [filename, ext] of tests) {
         expect(
            getRandomizedFilename(filename).split(".").pop(),
            `getRandomizedFilename(): ${filename} should end with ${ext}`,
         ).toBe(ext);
      }
   });
});
