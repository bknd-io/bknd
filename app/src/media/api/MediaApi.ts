import type { FileListObject } from "media";
import {
   type BaseModuleApiOptions,
   ModuleApi,
   type PrimaryFieldType,
   type TInput,
} from "modules/ModuleApi";
import type { FileWithPath } from "ui/elements/media/file-selector";

export type MediaApiOptions = BaseModuleApiOptions & {};

export class MediaApi extends ModuleApi<MediaApiOptions> {
   protected override getDefaultOptions(): Partial<MediaApiOptions> {
      return {
         basepath: "/api/media",
      };
   }

   listFiles() {
      return this.get<FileListObject[]>(["files"]);
   }

   getFile(filename: string) {
      return this.get<ReadableStream<Uint8Array>>(["file", filename], undefined, {
         headers: {
            Accept: "*/*",
         },
      });
   }

   async getFileStream(filename: string): Promise<ReadableStream<Uint8Array>> {
      const { res } = await this.getFile(filename);
      if (!res.ok || !res.body) {
         throw new Error("Failed to fetch file");
      }
      return res.body;
   }

   async download(filename: string): Promise<File> {
      const { res } = await this.getFile(filename);
      if (!res.ok || !res.body) {
         throw new Error("Failed to fetch file");
      }
      return (await res.blob()) as File;
   }

   getFileUploadUrl(file?: FileWithPath): string {
      if (!file) return this.getUrl("/upload");
      return this.getUrl(`/upload/${file.path}`);
   }

   getEntityUploadUrl(entity: string, id: PrimaryFieldType, field: string) {
      return this.getUrl(`/entity/${entity}/${id}/${field}`);
   }

   getUploadHeaders(): Headers {
      return new Headers({
         Authorization: `Bearer ${this.options.token}`,
      });
   }

   protected uploadFile(
      body: File | ReadableStream,
      opts?: {
         filename?: string;
         path?: TInput;
         _init?: Omit<RequestInit, "body">;
      },
   ) {
      const headers = {
         "Content-Type": "application/octet-stream",
         ...(opts?._init?.headers || {}),
      };
      let name: string = opts?.filename || "";
      try {
         if (typeof (body as File).type !== "undefined") {
            headers["Content-Type"] = (body as File).type;
         }
         if (!opts?.filename) {
            name = (body as File).name;
         }
      } catch (e) {}

      if (name && name.length > 0 && name.includes("/")) {
         name = name.split("/").pop() || "";
      }

      const init = {
         ...(opts?._init || {}),
         headers,
      };
      if (opts?.path) {
         return this.post(opts.path, body, init);
      }

      if (!name || name.length === 0) {
         throw new Error("Invalid filename");
      }

      return this.post(opts?.path ?? ["upload", name], body, init);
   }

   async upload(
      item: Request | Response | string | File | ReadableStream,
      opts: {
         filename?: string;
         _init?: Omit<RequestInit, "body">;
         path?: TInput;
      } = {},
   ) {
      if (item instanceof Request || typeof item === "string") {
         const res = await this.fetcher(item);
         if (!res.ok || !res.body) {
            throw new Error("Failed to fetch file");
         }
         return this.uploadFile(res.body, opts);
      } else if (item instanceof Response) {
         if (!item.body) {
            throw new Error("Invalid response");
         }
         return this.uploadFile(item.body, {
            ...(opts ?? {}),
            _init: {
               ...(opts._init ?? {}),
               headers: {
                  ...(opts._init?.headers ?? {}),
                  "Content-Type": item.headers.get("Content-Type") || "application/octet-stream",
               },
            },
         });
      }

      return this.uploadFile(item, opts);
   }

   async uploadToEntity(
      entity: string,
      id: PrimaryFieldType,
      field: string,
      item: Request | Response | string | File | ReadableStream,
      opts?: {
         _init?: Omit<RequestInit, "body">;
      },
   ) {
      return this.upload(item, {
         ...opts,
         path: ["entity", entity, id, field],
      });
   }

   deleteFile(filename: string) {
      return this.delete(["file", filename]);
   }
}
