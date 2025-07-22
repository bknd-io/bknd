import { readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import type { FileBody, FileListObject, FileMeta, FileUploadPayload } from "bknd";
import { StorageAdapter, guessMimeType } from "bknd";
import { parse, s, isFile } from "bknd/utils";

export const localAdapterConfig = s.object(
   {
      path: s.string({ default: "./" }),
   },
   { title: "Local", description: "Local file system storage", additionalProperties: false },
);
export type LocalAdapterConfig = s.Static<typeof localAdapterConfig>;

export class StorageLocalAdapter extends StorageAdapter {
   private config: LocalAdapterConfig;

   constructor(config: Partial<LocalAdapterConfig> = {}) {
      super();
      this.config = parse(localAdapterConfig, config);
   }

   getSchema() {
      return localAdapterConfig;
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
      await writeFile(filePath, isFile(body) ? body.stream() : body);

      return await this.computeEtag(body);
   }

   async deleteObject(key: string): Promise<void> {
      try {
         await unlink(`${this.config.path}/${key}`);
      } catch (e) {}
   }

   async objectExists(key: string): Promise<boolean> {
      try {
         const stats = await stat(`${this.config.path}/${key}`);
         return stats.isFile();
      } catch (error) {
         return false;
      }
   }

   async getObject(key: string, headers: Headers): Promise<Response> {
      try {
         const content = await readFile(`${this.config.path}/${key}`);
         const mimeType = guessMimeType(key);

         return new Response(content, {
            status: 200,
            headers: {
               "Content-Type": mimeType || "application/octet-stream",
               "Content-Length": content.length.toString(),
            },
         });
      } catch (error) {
         // Handle file reading errors
         return new Response("", { status: 404 });
      }
   }

   getObjectUrl(key: string): string {
      throw new Error("Method not implemented.");
   }

   async getObjectMeta(key: string): Promise<FileMeta> {
      const stats = await stat(`${this.config.path}/${key}`);
      return {
         type: guessMimeType(key) || "application/octet-stream",
         size: stats.size,
      };
   }

   toJSON(secrets?: boolean) {
      return {
         type: this.getName(),
         config: this.config,
      };
   }
}
