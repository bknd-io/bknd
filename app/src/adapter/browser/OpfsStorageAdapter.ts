import type { FileBody, FileListObject, FileMeta, FileUploadPayload } from "bknd";
import { StorageAdapter, guessMimeType } from "bknd";
import { parse, s, isFile, isBlob } from "bknd/utils";

export const opfsAdapterConfig = s.object(
   {
      root: s.string({ default: "" }),
   },
   {
      title: "OPFS",
      description: "Origin Private File System storage",
      additionalProperties: false,
   },
);
export type OpfsAdapterConfig = s.Static<typeof opfsAdapterConfig>;

/**
 * Storage adapter for OPFS (Origin Private File System)
 * Provides browser-based file storage using the File System Access API
 */
export class OpfsStorageAdapter extends StorageAdapter {
   private config: OpfsAdapterConfig;
   private rootPromise: Promise<FileSystemDirectoryHandle>;

   constructor(config: Partial<OpfsAdapterConfig> = {}) {
      super();
      this.config = parse(opfsAdapterConfig, config);
      this.rootPromise = this.initializeRoot();
   }

   private async initializeRoot(): Promise<FileSystemDirectoryHandle> {
      const opfsRoot = await navigator.storage.getDirectory();
      if (!this.config.root) {
         return opfsRoot;
      }

      // navigate to or create nested directory structure
      const parts = this.config.root.split("/").filter(Boolean);
      let current = opfsRoot;
      for (const part of parts) {
         current = await current.getDirectoryHandle(part, { create: true });
      }
      return current;
   }

   getSchema() {
      return opfsAdapterConfig;
   }

   getName(): string {
      return "opfs";
   }

   async listObjects(prefix?: string): Promise<FileListObject[]> {
      const root = await this.rootPromise;
      const files: FileListObject[] = [];

      for await (const [name, handle] of root.entries()) {
         if (handle.kind === "file") {
            if (!prefix || name.startsWith(prefix)) {
               const file = await (handle as FileSystemFileHandle).getFile();
               files.push({
                  key: name,
                  last_modified: new Date(file.lastModified),
                  size: file.size,
               });
            }
         }
      }

      return files;
   }

   private async computeEtagFromArrayBuffer(buffer: ArrayBuffer): Promise<string> {
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");

      // wrap the hex string in quotes for ETag format
      return `"${hashHex}"`;
   }

   async putObject(key: string, body: FileBody): Promise<string | FileUploadPayload> {
      if (body === null) {
         throw new Error("Body is empty");
      }

      const root = await this.rootPromise;
      const fileHandle = await root.getFileHandle(key, { create: true });
      const writable = await fileHandle.createWritable();

      try {
         let contentBuffer: ArrayBuffer;

         if (isFile(body)) {
            contentBuffer = await body.arrayBuffer();
            await writable.write(contentBuffer);
         } else if (body instanceof ReadableStream) {
            const chunks: Uint8Array[] = [];
            const reader = body.getReader();
            try {
               while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  chunks.push(value);
                  await writable.write(value);
               }
            } finally {
               reader.releaseLock();
            }
            // compute total size and combine chunks for etag
            const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const combined = new Uint8Array(totalSize);
            let offset = 0;
            for (const chunk of chunks) {
               combined.set(chunk, offset);
               offset += chunk.length;
            }
            contentBuffer = combined.buffer;
         } else if (isBlob(body)) {
            contentBuffer = await (body as Blob).arrayBuffer();
            await writable.write(contentBuffer);
         } else {
            // body is ArrayBuffer or ArrayBufferView
            if (ArrayBuffer.isView(body)) {
               const view = body as ArrayBufferView;
               contentBuffer = view.buffer.slice(
                  view.byteOffset,
                  view.byteOffset + view.byteLength,
               ) as ArrayBuffer;
            } else {
               contentBuffer = body as ArrayBuffer;
            }
            await writable.write(body);
         }

         await writable.close();
         return await this.computeEtagFromArrayBuffer(contentBuffer);
      } catch (error) {
         await writable.abort();
         throw error;
      }
   }

   async deleteObject(key: string): Promise<void> {
      try {
         const root = await this.rootPromise;
         await root.removeEntry(key);
      } catch {
         // file doesn't exist, which is fine
      }
   }

   async objectExists(key: string): Promise<boolean> {
      try {
         const root = await this.rootPromise;
         await root.getFileHandle(key);
         return true;
      } catch {
         return false;
      }
   }

   private parseRangeHeader(
      rangeHeader: string,
      fileSize: number,
   ): { start: number; end: number } | null {
      // parse "bytes=start-end" format
      const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
      if (!match) return null;

      const [, startStr, endStr] = match;
      let start = startStr ? Number.parseInt(startStr, 10) : 0;
      let end = endStr ? Number.parseInt(endStr, 10) : fileSize - 1;

      // handle suffix-byte-range-spec (e.g., "bytes=-500")
      if (!startStr && endStr) {
         start = Math.max(0, fileSize - Number.parseInt(endStr, 10));
         end = fileSize - 1;
      }

      // validate range
      if (start < 0 || end >= fileSize || start > end) {
         return null;
      }

      return { start, end };
   }

   async getObject(key: string, headers: Headers): Promise<Response> {
      try {
         const root = await this.rootPromise;
         const fileHandle = await root.getFileHandle(key);
         const file = await fileHandle.getFile();
         const fileSize = file.size;
         const mimeType = guessMimeType(key);

         const responseHeaders = new Headers({
            "Accept-Ranges": "bytes",
            "Content-Type": mimeType || "application/octet-stream",
         });

         const rangeHeader = headers.get("range");

         if (rangeHeader) {
            const range = this.parseRangeHeader(rangeHeader, fileSize);

            if (!range) {
               // invalid range - return 416 Range Not Satisfiable
               responseHeaders.set("Content-Range", `bytes */${fileSize}`);
               return new Response("", {
                  status: 416,
                  headers: responseHeaders,
               });
            }

            const { start, end } = range;
            const arrayBuffer = await file.arrayBuffer();
            const chunk = arrayBuffer.slice(start, end + 1);

            responseHeaders.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
            responseHeaders.set("Content-Length", chunk.byteLength.toString());

            return new Response(chunk, {
               status: 206, // Partial Content
               headers: responseHeaders,
            });
         } else {
            // normal request - return entire file
            const content = await file.arrayBuffer();
            responseHeaders.set("Content-Length", content.byteLength.toString());

            return new Response(content, {
               status: 200,
               headers: responseHeaders,
            });
         }
      } catch {
         // handle file reading errors
         return new Response("", { status: 404 });
      }
   }

   getObjectUrl(_key: string): string {
      throw new Error("Method not implemented.");
   }

   async getObjectMeta(key: string): Promise<FileMeta> {
      const root = await this.rootPromise;
      const fileHandle = await root.getFileHandle(key);
      const file = await fileHandle.getFile();

      return {
         type: guessMimeType(key) || "application/octet-stream",
         size: file.size,
      };
   }

   toJSON(_secrets?: boolean) {
      return {
         type: this.getName(),
         config: this.config,
      };
   }
}
