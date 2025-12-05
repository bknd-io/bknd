// mock OPFS API for testing
class MockFileSystemFileHandle {
   kind: "file" = "file";
   name: string;
   private content: ArrayBuffer;
   private lastModified: number;

   constructor(name: string, content: ArrayBuffer = new ArrayBuffer(0)) {
      this.name = name;
      this.content = content;
      this.lastModified = Date.now();
   }

   async getFile(): Promise<File> {
      return new File([this.content], this.name, {
         lastModified: this.lastModified,
         type: this.guessMimeType(),
      });
   }

   async createWritable(): Promise<FileSystemWritableFileStream> {
      const handle = this;
      return {
         async write(data: any) {
            if (data instanceof ArrayBuffer) {
               handle.content = data;
            } else if (ArrayBuffer.isView(data)) {
               handle.content = data.buffer.slice(
                  data.byteOffset,
                  data.byteOffset + data.byteLength,
               ) as ArrayBuffer;
            } else if (data instanceof Blob) {
               handle.content = await data.arrayBuffer();
            }
            handle.lastModified = Date.now();
         },
         async close() {},
         async abort() {},
         async seek(_position: number) {},
         async truncate(_size: number) {},
      } as FileSystemWritableFileStream;
   }

   private guessMimeType(): string {
      const ext = this.name.split(".").pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
         png: "image/png",
         jpg: "image/jpeg",
         jpeg: "image/jpeg",
         gif: "image/gif",
         webp: "image/webp",
         svg: "image/svg+xml",
         txt: "text/plain",
         json: "application/json",
         pdf: "application/pdf",
      };
      return mimeTypes[ext || ""] || "application/octet-stream";
   }
}

export class MockFileSystemDirectoryHandle {
   kind: "directory" = "directory";
   name: string;
   private files: Map<string, MockFileSystemFileHandle> = new Map();
   private directories: Map<string, MockFileSystemDirectoryHandle> = new Map();

   constructor(name: string = "root") {
      this.name = name;
   }

   async getFileHandle(
      name: string,
      options?: FileSystemGetFileOptions,
   ): Promise<FileSystemFileHandle> {
      if (this.files.has(name)) {
         return this.files.get(name) as any;
      }
      if (options?.create) {
         const handle = new MockFileSystemFileHandle(name);
         this.files.set(name, handle);
         return handle as any;
      }
      throw new Error(`File not found: ${name}`);
   }

   async getDirectoryHandle(
      name: string,
      options?: FileSystemGetDirectoryOptions,
   ): Promise<FileSystemDirectoryHandle> {
      if (this.directories.has(name)) {
         return this.directories.get(name) as any;
      }
      if (options?.create) {
         const handle = new MockFileSystemDirectoryHandle(name);
         this.directories.set(name, handle);
         return handle as any;
      }
      throw new Error(`Directory not found: ${name}`);
   }

   async removeEntry(name: string, _options?: FileSystemRemoveOptions): Promise<void> {
      this.files.delete(name);
      this.directories.delete(name);
   }

   async *entries(): AsyncIterableIterator<[string, FileSystemHandle]> {
      for (const [name, handle] of this.files) {
         yield [name, handle as any];
      }
      for (const [name, handle] of this.directories) {
         yield [name, handle as any];
      }
   }

   async *keys(): AsyncIterableIterator<string> {
      for (const name of this.files.keys()) {
         yield name;
      }
      for (const name of this.directories.keys()) {
         yield name;
      }
   }

   async *values(): AsyncIterableIterator<FileSystemHandle> {
      for (const handle of this.files.values()) {
         yield handle as any;
      }
      for (const handle of this.directories.values()) {
         yield handle as any;
      }
   }

   [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]> {
      return this.entries();
   }
}
