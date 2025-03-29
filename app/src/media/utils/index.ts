import { isFile, randomString } from "core/utils";
import { extension } from "media/storage/mime-types-tiny";

export function getExtensionFromName(filename: string): string | undefined {
   if (!filename.includes(".")) return;

   const parts = filename.split(".");
   return parts[parts.length - 1]?.toLowerCase();
}

export function getRandomizedFilename(file: File, length?: number): string;
export function getRandomizedFilename(file: string, length?: number): string;
export function getRandomizedFilename(file: File | string, length = 16): string {
   const filename = typeof file === "string" ? file : file.name;

   if (typeof filename !== "string") {
      console.error("Couldn't extract filename from", file);
      throw new Error("Invalid file name");
   }

   let ext = getExtensionFromName(filename);
   if (!ext && isFile(file) && file.type) {
      const _ext = extension(file.type);
      if (_ext.length > 0) ext = _ext;
   }

   // @todo: use uuid instead?
   return [randomString(length), ext].filter(Boolean).join(".");
}
