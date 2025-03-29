import { extension, guess, isMimeType } from "media/storage/mime-types-tiny";
import { randomString } from "core/utils/strings";
import type { Context } from "hono";
import { invariant } from "core/utils/runtime";

export function getContentName(request: Request): string | undefined;
export function getContentName(contentDisposition: string): string | undefined;
export function getContentName(headers: Headers): string | undefined;
export function getContentName(ctx: Headers | Request | string): string | undefined {
   let c: string = "";

   if (typeof ctx === "string") {
      c = ctx;
   } else if (ctx instanceof Headers) {
      c = ctx.get("Content-Disposition") || "";
   } else if (ctx instanceof Request) {
      c = ctx.headers.get("Content-Disposition") || "";
   }

   const match = c.match(/filename\*?=(?:UTF-8'')?("?)([^";]+)\1/);
   return match ? match[2] : undefined;
}

export function isReadableStream(value: unknown): value is ReadableStream {
   return (
      typeof value === "object" &&
      value !== null &&
      typeof (value as ReadableStream).getReader === "function"
   );
}

export function isBlob(value: unknown): value is Blob {
   return (
      typeof value === "object" &&
      value !== null &&
      typeof (value as Blob).arrayBuffer === "function" &&
      typeof (value as Blob).type === "string"
   );
}

export function isFile(value: unknown): value is File {
   return (
      isBlob(value) &&
      typeof (value as File).name === "string" &&
      typeof (value as File).lastModified === "number"
   );
}

export function isArrayBuffer(value: unknown): value is ArrayBuffer {
   return (
      typeof value === "object" &&
      value !== null &&
      Object.prototype.toString.call(value) === "[object ArrayBuffer]"
   );
}

export function isArrayBufferView(value: unknown): value is ArrayBufferView {
   return typeof value === "object" && value !== null && ArrayBuffer.isView(value);
}

const FILE_SIGNATURES: Record<string, string> = {
   "89504E47": "image/png",
   FFD8FF: "image/jpeg",
   "47494638": "image/gif",
   "49492A00": "image/tiff", // Little Endian TIFF
   "4D4D002A": "image/tiff", // Big Endian TIFF
   "52494646????57454250": "image/webp", // WEBP (RIFF....WEBP)
   "504B0304": "application/zip",
   "25504446": "application/pdf",
   "00000020667479706D70": "video/mp4",
   "000001BA": "video/mpeg",
   "000001B3": "video/mpeg",
   "1A45DFA3": "video/webm",
   "4F676753": "audio/ogg",
   "494433": "audio/mpeg", // MP3 with ID3 header
   FFF1: "audio/aac",
   FFF9: "audio/aac",
   "52494646????41564920": "audio/wav",
   "52494646????57415645": "audio/wave",
   "52494646????415550": "audio/aiff",
};

async function detectMimeType(
   input: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | File | null,
): Promise<string | undefined> {
   if (!input) return;

   let buffer: Uint8Array;

   if (isReadableStream(input)) {
      const reader = input.getReader();
      const { value } = await reader.read();
      if (!value) return;
      buffer = new Uint8Array(value);
   } else if (isBlob(input) || isFile(input)) {
      buffer = new Uint8Array(await input.slice(0, 12).arrayBuffer());
   } else if (isArrayBuffer(input)) {
      buffer = new Uint8Array(input);
   } else if (isArrayBufferView(input)) {
      buffer = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
   } else if (typeof input === "string") {
      buffer = new TextEncoder().encode(input);
   } else {
      return;
   }

   const hex = Array.from(buffer.slice(0, 12))
      .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
      .join("");

   for (const [signature, mime] of Object.entries(FILE_SIGNATURES)) {
      const regex = new RegExp("^" + signature.replace(/\?\?/g, ".."));
      if (regex.test(hex)) return mime;
   }

   return;
}

export async function getFileFromContext(c: Context<any>): Promise<File> {
   const contentType = c.req.header("Content-Type") ?? "application/octet-stream";

   if (
      contentType?.startsWith("multipart/form-data") ||
      contentType?.startsWith("application/x-www-form-urlencoded")
   ) {
      try {
         const f = await c.req.formData();
         if ([...f.values()].length > 0) {
            const v = [...f.values()][0];
            return await blobToFile(v);
         }
      } catch (e) {
         console.warn("Error parsing form data", e);
      }
   } else {
      try {
         const blob = await c.req.blob();
         if (isFile(blob)) {
            return blob;
         } else if (isBlob(blob)) {
            return await blobToFile(blob, { name: getContentName(c.req.raw), type: contentType });
         }
      } catch (e) {
         console.warn("Error parsing blob", e);
      }
   }

   throw new Error("No file found in request");
}

export async function getBodyFromContext(c: Context<any>): Promise<ReadableStream | File> {
   const contentType = c.req.header("Content-Type") ?? "application/octet-stream";

   if (
      !contentType?.startsWith("multipart/form-data") &&
      !contentType?.startsWith("application/x-www-form-urlencoded")
   ) {
      const body = c.req.raw.body;
      if (body) {
         return body;
      }
   }

   return getFileFromContext(c);
}

type ImageDim = { width: number; height: number };
export async function detectImageDimensions(
   input: ArrayBuffer,
   type: `image/${string}`,
): Promise<ImageDim>;
export async function detectImageDimensions(input: File): Promise<ImageDim>;
export async function detectImageDimensions(
   input: File | ArrayBuffer,
   _type?: `image/${string}`,
): Promise<ImageDim> {
   // Only process images
   const is_file = isFile(input);
   const type = is_file ? input.type : _type!;

   invariant(type && typeof type === "string" && type.startsWith("image/"), "type must be image/*");

   const buffer = is_file ? await input.arrayBuffer() : input;
   invariant(buffer.byteLength >= 128, "Buffer must be at least 128 bytes");

   const dataView = new DataView(buffer);

   if (type === "image/jpeg") {
      let offset = 2;
      while (offset < dataView.byteLength) {
         const marker = dataView.getUint16(offset);
         offset += 2;
         if (marker === 0xffc0 || marker === 0xffc2) {
            return {
               width: dataView.getUint16(offset + 5),
               height: dataView.getUint16(offset + 3),
            };
         }
         offset += dataView.getUint16(offset);
      }
   } else if (type === "image/png") {
      return {
         width: dataView.getUint32(16),
         height: dataView.getUint32(20),
      };
   } else if (type === "image/gif") {
      return {
         width: dataView.getUint16(6),
         height: dataView.getUint16(8),
      };
   } else if (type === "image/tiff") {
      const isLittleEndian = dataView.getUint16(0) === 0x4949;
      const offset = dataView.getUint32(4, isLittleEndian);
      const width = dataView.getUint32(offset + 18, isLittleEndian);
      const height = dataView.getUint32(offset + 10, isLittleEndian);
      return { width, height };
   }

   throw new Error("Unsupported image format");
}

export async function blobToFile(
   blob: Blob | File | unknown,
   overrides: FilePropertyBag & { name?: string } = {},
): Promise<File> {
   if (isFile(blob)) return blob;
   if (!isBlob(blob)) throw new Error("Not a Blob");

   const type = isMimeType(overrides.type, ["application/octet-stream"])
      ? overrides.type
      : await detectMimeType(blob);
   const ext = type ? extension(type) : "";
   const name = overrides.name || [randomString(16), ext].filter(Boolean).join(".");

   return new File([blob], name, {
      type: type || guess(name),
      lastModified: Date.now(),
   });
}
