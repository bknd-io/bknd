import type { FileListObject, FileMeta, FileBody, FileUploadPayload } from "media/storage/Storage";
import type { s } from "bknd/utils";

const SYMBOL = Symbol.for("bknd:storage");

export abstract class StorageAdapter {
   constructor() {
      this[SYMBOL] = true;
   }

   /**
    * This is a helper function to manage Connection classes
    * coming from different places
    * @param conn
    */
   static isAdapter(conn: unknown): conn is StorageAdapter {
      if (!conn) return false;
      return conn[SYMBOL] === true;
   }

   /**
    * The unique name of the storage adapter
    */
   abstract getName(): string;

   // @todo: method requires limit/offset parameters
   abstract listObjects(prefix?: string): Promise<FileListObject[]>;
   abstract putObject(key: string, body: FileBody): Promise<string | FileUploadPayload | undefined>;
   abstract deleteObject(key: string): Promise<void>;
   abstract objectExists(key: string): Promise<boolean>;
   abstract getObject(key: string, headers: Headers): Promise<Response>;
   abstract getObjectUrl(key: string): string;
   abstract getObjectMeta(key: string): Promise<FileMeta>;
   abstract getSchema(): s.Schema | undefined;
   abstract toJSON(secrets?: boolean): any;
}
