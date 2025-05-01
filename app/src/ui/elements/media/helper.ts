import type { MediaFieldSchema } from "media/AppMedia";
import type { FileState } from "./Dropzone";

export function mediaItemToFileState(
   item: MediaFieldSchema,
   options: {
      overrides?: Partial<FileState>;
      baseUrl?: string;
   } = { overrides: {}, baseUrl: "" },
): FileState {
   return {
      body: `${options.baseUrl}/api/media/file/${item.path}`,
      path: item.path,
      name: item.path,
      size: item.size ?? 0,
      type: item.mime_type ?? "",
      state: "uploaded",
      progress: 0,
      ...options.overrides,
   };
}

export function mediaItemsToFileStates(
   items: MediaFieldSchema[],
   options: {
      overrides?: Partial<FileState>;
      baseUrl?: string;
   } = { overrides: {}, baseUrl: "" },
): FileState[] {
   return items.map((item) => mediaItemToFileState(item, options));
}

export function checkMaxReached({
   maxItems,
   current = 0,
   overwrite,
   added,
}: { maxItems?: number; current?: number; overwrite?: boolean; added: number }) {
   if (!maxItems) {
      return {
         reject: false,
         to_drop: 0,
      };
   }

   const remaining = maxItems - current;
   const to_drop = added > remaining ? added : added - remaining > 0 ? added - remaining : 0;
   const reject = overwrite ? added > maxItems : remaining - added < 0;

   return {
      reject,
      to_drop,
   };
}
