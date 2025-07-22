import { describe, expect, test } from "bun:test";
import { type FileBody, Storage } from "../../src/media/storage/Storage";
import * as StorageEvents from "../../src/media/storage/events";
import { StorageAdapter } from "media/storage/StorageAdapter";

class TestAdapter extends StorageAdapter {
   files: Record<string, FileBody> = {};

   getName() {
      return "test";
   }

   getSchema() {
      return undefined;
   }

   async listObjects(prefix?: string) {
      return [];
   }

   async putObject(key: string, body: FileBody) {
      this.files[key] = body;
      return "etag-string";
   }

   async deleteObject(key: string) {
      delete this.files[key];
   }

   async objectExists(key: string) {
      return key in this.files;
   }

   async getObject(key: string) {
      return new Response(this.files[key]);
   }

   getObjectUrl(key: string) {
      return key;
   }

   async getObjectMeta(key: string) {
      return { type: "text/plain", size: 0 };
   }

   toJSON(secrets?: boolean): any {
      return { name: this.getName() };
   }
}

describe("Storage", async () => {
   const adapter = new TestAdapter();
   const storage = new Storage(adapter);
   const events = new Map<string, any>();

   storage.emgr.onAny((event) => {
      // @ts-ignore
      events.set(event.constructor.slug, event);
      //console.log("event", event.constructor.slug, event);
   });

   test("uploads a file", async () => {
      const {
         meta: { type, size },
      } = await storage.uploadFile("hello" as any, "world.txt");
      expect({ type, size }).toEqual({ type: "text/plain", size: 0 });
   });

   test("deletes the file", async () => {
      expect(await storage.deleteFile("hello")).toBeUndefined();
      expect(await storage.fileExists("hello")).toBeFalse();
   });

   test("events were fired", async () => {
      await storage.emgr.executeAsyncs();
      expect(events.has(StorageEvents.FileUploadedEvent.slug)).toBeTrue();
      expect(events.has(StorageEvents.FileDeletedEvent.slug)).toBeTrue();
      // @todo: file access must be tested in controllers
      //expect(events.has(StorageEvents.FileAccessEvent.slug)).toBeTrue();
   });

   // @todo: test controllers
});
