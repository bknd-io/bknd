/**
 * From https://github.com/react-dropzone/file-selector
 * slightly adjusted
 * MIT License (2020 Roland Groza)
 */

import { guess } from "media/storage/mime-types-tiny";

const FILES_TO_IGNORE = [
   // Thumbnail cache files for macOS and Windows
   ".DS_Store", // macOs
   "Thumbs.db" // Windows
];

export function toFileWithPath(file: FileWithPath, path?: string): FileWithPath {
   const f = withMimeType(file);
   if (typeof f.path !== "string") {
      // on electron, path is already set to the absolute path
      const { webkitRelativePath } = file;
      Object.defineProperty(f, "path", {
         value:
            typeof path === "string"
               ? path
               : // If <input webkitdirectory> is set,
                 // the File will have a {webkitRelativePath} property
                 // https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory
                 typeof webkitRelativePath === "string" && webkitRelativePath.length > 0
                 ? webkitRelativePath
                 : file.name,
         writable: false,
         configurable: false,
         enumerable: true
      });
   }

   return f;
}

export interface FileWithPath extends File {
   readonly path?: string;
}

function withMimeType(file: FileWithPath) {
   const { name } = file;
   const hasExtension = name && name.lastIndexOf(".") !== -1;

   console.log("withMimeType", name, hasExtension);

   if (hasExtension && !file.type) {
      const type = guess(name);
      console.log("guessed", type);

      if (type) {
         Object.defineProperty(file, "type", {
            value: type,
            writable: false,
            configurable: false,
            enumerable: true
         });
      }
   }

   return file;
}

export interface FileWithPath extends File {
   readonly path?: string;
}

/**
 * Convert a DragEvent's DataTrasfer object to a list of File objects
 * NOTE: If some of the items are folders,
 * everything will be flattened and placed in the same list but the paths will be kept as a {path} property.
 *
 * EXPERIMENTAL: A list of https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle objects can also be passed as an arg
 * and a list of File objects will be returned.
 *
 * @param evt
 */
export async function fromEvent(evt: Event | any): Promise<(FileWithPath | DataTransferItem)[]> {
   if (isObject<DragEvent>(evt) && isDataTransfer(evt.dataTransfer)) {
      return getDataTransferFiles(evt.dataTransfer, evt.type);
   } else if (isChangeEvt(evt)) {
      return getInputFiles(evt);
   } else if (
      Array.isArray(evt) &&
      evt.every((item) => "getFile" in item && typeof item.getFile === "function")
   ) {
      return getFsHandleFiles(evt);
   }
   return [];
}

function isDataTransfer(value: any): value is DataTransfer {
   return isObject(value);
}

function isChangeEvt(value: any): value is Event {
   return isObject<Event>(value) && isObject(value.target);
}

function isObject<T>(v: any): v is T {
   return typeof v === "object" && v !== null;
}

function getInputFiles(evt: Event) {
   return fromList<FileWithPath>((evt.target as HTMLInputElement).files).map((file) =>
      toFileWithPath(file)
   );
}

// Ee expect each handle to be https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle
async function getFsHandleFiles(handles: any[]) {
   const files = await Promise.all(handles.map((h) => h.getFile()));
   return files.map((file) => toFileWithPath(file));
}

async function getDataTransferFiles(dt: DataTransfer, type: string) {
   // IE11 does not support dataTransfer.items
   // See https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/items#Browser_compatibility
   if (dt.items) {
      const items = fromList<DataTransferItem>(dt.items).filter((item) => item.kind === "file");
      // According to https://html.spec.whatwg.org/multipage/dnd.html#dndevents,
      // only 'dragstart' and 'drop' has access to the data (source node)
      if (type !== "drop") {
         return items;
      }
      const files = await Promise.all(items.map(toFilePromises));
      return noIgnoredFiles(flatten<FileWithPath>(files));
   }

   return noIgnoredFiles(fromList<FileWithPath>(dt.files).map((file) => toFileWithPath(file)));
}

function noIgnoredFiles(files: FileWithPath[]) {
   return files.filter((file) => FILES_TO_IGNORE.indexOf(file.name) === -1);
}

// IE11 does not support Array.from()
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from#Browser_compatibility
// https://developer.mozilla.org/en-US/docs/Web/API/FileList
// https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItemList
function fromList<T>(items: DataTransferItemList | FileList | null): T[] {
   if (items === null) {
      return [];
   }

   const files: any[] = [];

   // tslint:disable: prefer-for-of
   for (let i = 0; i < items.length; i++) {
      const file = items[i];
      files.push(file);
   }

   return files;
}

// https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItem
function toFilePromises(item: DataTransferItem) {
   if (typeof item.webkitGetAsEntry !== "function") {
      return fromDataTransferItem(item);
   }

   const entry = item.webkitGetAsEntry();

   // Safari supports dropping an image node from a different window and can be retrieved using
   // the DataTransferItem.getAsFile() API
   // NOTE: FileSystemEntry.file() throws if trying to get the file
   if (entry?.isDirectory) {
      return fromDirEntry(entry) as any;
   }

   return fromDataTransferItem(item);
}

function flatten<T>(items: any[]): T[] {
   return items.reduce(
      (acc, files) => [
         // biome-ignore lint/performance/noAccumulatingSpread: <explanation>
         ...acc,
         ...(Array.isArray(files) ? flatten(files) : [files])
      ],
      []
   );
}

function fromDataTransferItem(item: DataTransferItem) {
   const file = item.getAsFile();
   if (!file) {
      return Promise.reject(`${item} is not a File`);
   }
   const fwp = toFileWithPath(file);
   return Promise.resolve(fwp);
}

// https://developer.mozilla.org/en-US/docs/Web/API/FileSystemEntry
async function fromEntry(entry: any) {
   return entry.isDirectory ? fromDirEntry(entry) : fromFileEntry(entry);
}

// https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryEntry
function fromDirEntry(entry: any) {
   const reader = entry.createReader();

   return new Promise<FileArray[]>((resolve, reject) => {
      const entries: Promise<FileValue[]>[] = [];

      function readEntries() {
         // https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryEntry/createReader
         // https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryReader/readEntries
         reader.readEntries(
            async (batch: any[]) => {
               if (!batch.length) {
                  // Done reading directory
                  try {
                     const files = await Promise.all(entries);
                     resolve(files);
                  } catch (err) {
                     reject(err);
                  }
               } else {
                  const items = Promise.all(batch.map(fromEntry));
                  entries.push(items);

                  // Continue reading
                  readEntries();
               }
            },
            (err: any) => {
               reject(err);
            }
         );
      }

      readEntries();
   });
}

// https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileEntry
async function fromFileEntry(entry: any) {
   return new Promise<FileWithPath>((resolve, reject) => {
      entry.file(
         (file: FileWithPath) => {
            const fwp = toFileWithPath(file, entry.fullPath);
            resolve(fwp);
         },
         (err: any) => {
            reject(err);
         }
      );
   });
}

// Infinite type recursion
// https://github.com/Microsoft/TypeScript/issues/3496#issuecomment-128553540
interface FileArray extends Array<FileValue> {}
type FileValue = FileWithPath | FileArray[];
