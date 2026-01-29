import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { FileBody, FileListObject, FileMeta, FileUploadPayload } from "bknd";
import { StorageAdapter, guessMimeType } from "bknd";
import { parse, isFile, s } from "bknd/utils";
import { localAdapterSchema } from "media/storage/adapter-schemas";

// Re-export the schema and type for backwards compatibility
export const localAdapterConfig = localAdapterSchema;
export type LocalAdapterConfig = s.Static<typeof localAdapterSchema>;

export class StorageLocalAdapter extends StorageAdapter {
   private config: LocalAdapterConfig;

   constructor(config: Partial<LocalAdapterConfig> = {}) {
      super();
      this.config = parse(localAdapterSchema, config);
   }

   getSchema() {
      return localAdapterSchema;
   }

   getName(): string {
      return "local";
   }

   async listObjects(prefix?: string): Promise<FileListObject[]> {
      const files = await readdir(this.config.path);
      const fileStats = await Promise.all(
         files
            .filter((file) => !prefix || file.startsWith(prefix))
            .map(async (file) => {
               const stats = await stat(`${this.config.path}/${file}`);
               return {
                  key: file,
                  last_modified: stats.mtime,
                  size: stats.size,
               };
            }),
      );
      return fileStats;
   }

   private async computeEtag(body: FileBody): Promise<string> {
      const content = isFile(body) ? body : new Response(body);
      const hashBuffer = await crypto.subtle.digest("SHA-256", await content.arrayBuffer());
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");

      // Wrap the hex string in quotes for ETag format
      return `"${hashHex}"`;
   }

   async putObject(key: string, body: FileBody): Promise<string | FileUploadPayload> {
      if (body === null) {
         throw new Error("Body is empty");
      }

      const filePath = `${this.config.path}/${key}`;
      // Ensure parent directories exist
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, isFile(body) ? body.stream() : body);

      return await this.computeEtag(body);
   }

   async deleteObject(key: string): Promise<void> {
      try {
         await unlink(`${this.config.path}/${key}`);
      } catch (_e) {}
   }

   async objectExists(key: string): Promise<boolean> {
      try {
         const stats = await stat(`${this.config.path}/${key}`);
         return stats.isFile();
      } catch (_error) {
         return false;
      }
   }

   private parseRangeHeader(
      rangeHeader: string,
      fileSize: number,
   ): { start: number; end: number } | null {
      // Parse "bytes=start-end" format
      const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
      if (!match) return null;

      const [, startStr, endStr] = match;
      let start = startStr ? Number.parseInt(startStr, 10) : 0;
      let end = endStr ? Number.parseInt(endStr, 10) : fileSize - 1;

      // Handle suffix-byte-range-spec (e.g., "bytes=-500")
      if (!startStr && endStr) {
         start = Math.max(0, fileSize - Number.parseInt(endStr, 10));
         end = fileSize - 1;
      }

      // Validate range
      if (start < 0 || end >= fileSize || start > end) {
         return null;
      }

      return { start, end };
   }

   async getObject(key: string, headers: Headers): Promise<Response> {
      try {
         const filePath = `${this.config.path}/${key}`;
         const stats = await stat(filePath);
         const fileSize = stats.size;
         const mimeType = guessMimeType(key);

         const responseHeaders = new Headers({
            "Accept-Ranges": "bytes",
            "Content-Type": mimeType || "application/octet-stream",
         });

         const rangeHeader = headers.get("range");

         if (rangeHeader) {
            const range = this.parseRangeHeader(rangeHeader, fileSize);

            if (!range) {
               // Invalid range - return 416 Range Not Satisfiable
               responseHeaders.set("Content-Range", `bytes */${fileSize}`);
               return new Response("", {
                  status: 416,
                  headers: responseHeaders,
               });
            }

            const { start, end } = range;
            const content = await readFile(filePath, { encoding: null });
            const chunk = content.slice(start, end + 1);

            responseHeaders.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
            responseHeaders.set("Content-Length", chunk.length.toString());

            return new Response(chunk, {
               status: 206, // Partial Content
               headers: responseHeaders,
            });
         } else {
            // Normal request - return entire file
            const content = await readFile(filePath);
            responseHeaders.set("Content-Length", content.length.toString());

            return new Response(content, {
               status: 200,
               headers: responseHeaders,
            });
         }
      } catch (_error) {
         // Handle file reading errors
         return new Response("", { status: 404 });
      }
   }

   getObjectUrl(_key: string): string {
      throw new Error("Method not implemented.");
   }

   async getObjectMeta(key: string): Promise<FileMeta> {
      const stats = await stat(`${this.config.path}/${key}`);
      return {
         type: guessMimeType(key) || "application/octet-stream",
         size: stats.size,
      };
   }

   toJSON(_secrets?: boolean) {
      return {
         type: this.getName(),
         config: this.config,
      };
   }
}
