import type { DB } from "bknd";
import {
   type ComponentPropsWithRef,
   createContext,
   type ReactNode,
   type RefObject,
   useCallback,
   useContext,
   useEffect,
   useMemo,
   useRef,
   useState,
} from "react";
import { type FileWithPath, useDropzone } from "./use-dropzone";
import { checkMaxReached } from "./helper";
import { DropzoneInner } from "./DropzoneInner";
import { createDropzoneStore } from "ui/elements/media/dropzone-state";
import { useStore } from "zustand";

export type FileState = {
   body: FileWithPath | string;
   path: string;
   name: string;
   size: number;
   type: string;
   state: "pending" | "uploading" | "uploaded" | "failed" | "initial" | "deleting";
   progress: number;
};

export type FileStateWithData = FileState & { data: DB["media"] };

export type DropzoneRenderProps = {
   store: ReturnType<typeof createDropzoneStore>;
   wrapperRef: RefObject<HTMLDivElement | null>;
   inputProps: ComponentPropsWithRef<"input">;
   actions: {
      uploadFile: (file: { path: string }) => Promise<void>;
      deleteFile: (file: { path: string }) => Promise<void>;
      openFileInput: () => void;
      addFiles: (files: (File | FileWithPath)[]) => void;
   };
   showPlaceholder: boolean;
   onClick?: (file: { path: string }) => void;
   footer?: ReactNode;
   dropzoneProps: Pick<DropzoneProps, "maxItems" | "placeholder" | "autoUpload" | "flow">;
};

export type DropzoneProps = {
   /**
    * Get the upload info for a file
    */
   getUploadInfo: (file: { path: string }) => { url: string; headers?: Headers; method?: string };
   /**
    * Handle the deletion of a file
    */
   handleDelete: (file: { path: string }) => Promise<boolean>;
   /**
    * The initial items to display
    */
   initialItems?: FileState[];
   /**
    * Maximum number of media items that can be uploaded
    */
   maxItems?: number;
   /**
    * The allowed mime types
    */
   allowedMimeTypes?: string[];
   /**
    * If true, the media item will be overwritten on entity media uploads if limit was reached
    */
   overwrite?: boolean;
   /**
    * If true, the media items will be uploaded automatically
    */
   autoUpload?: boolean;
   /**
    * Whether to add new items to the start or end of the list
    * @default "start"
    */
   flow?: "start" | "end";
   /**
    * The on rejected callback
    */
   onRejected?: (files: FileWithPath[]) => void;
   /**
    * The on deleted callback
    */
   onDeleted?: (file: { path: string }) => void;
   /**
    * The on uploaded all callback
    */
   onUploadedAll?: (files: FileStateWithData[]) => void;
   /**
    * The on uploaded callback
    */
   onUploaded?: (file: FileStateWithData) => void;
   /**
    * The on clicked callback
    */
   onClick?: (file: FileState) => void;
   /**
    * The placeholder to use
    */
   placeholder?: {
      show?: boolean;
      text?: string;
   };
   /**
    * The footer to render
    */
   footer?: ReactNode;
   /**
    * The children to render
    */
   children?: ReactNode | ((props: DropzoneRenderProps) => ReactNode);
};

function handleUploadError(e: unknown) {
   if (e && e instanceof XMLHttpRequest) {
      const res = JSON.parse(e.responseText) as any;
      alert(`Upload failed with code ${e.status}: ${res.error}`);
   } else {
      alert("Upload failed");
   }
}

export function Dropzone({
   getUploadInfo,
   handleDelete,
   initialItems = [],
   flow = "start",
   allowedMimeTypes,
   maxItems,
   overwrite,
   autoUpload,
   placeholder,
   onRejected,
   onDeleted,
   onUploadedAll,
   onUploaded,
   children,
   onClick,
   footer,
}: DropzoneProps) {
   const store = useRef(createDropzoneStore()).current;
   const files = useStore(store, (state) => state.files);
   const setFiles = useStore(store, (state) => state.setFiles);
   const getFilesLength = useStore(store, (state) => state.getFilesLength);
   const setUploading = useStore(store, (state) => state.setUploading);
   const setIsOver = useStore(store, (state) => state.setIsOver);
   const uploading = useStore(store, (state) => state.uploading);
   const setFileState = useStore(store, (state) => state.setFileState);
   const removeFile = useStore(store, (state) => state.removeFile);
   const inputRef = useRef<HTMLInputElement>(null);

   useEffect(() => {
      // @todo: potentially keep pending ones
      setFiles(() => initialItems);
   }, [initialItems.length]);

   function isAllowed(i: DataTransferItem | DataTransferItem[] | File | File[]): boolean {
      const items = Array.isArray(i) ? i : [i];
      const specs = items.map((item) => ({
         kind: "kind" in item ? item.kind : "file",
         type: item.type,
         size: "size" in item ? item.size : 0,
      }));

      return specs.every((spec) => {
         if (spec.kind !== "file") {
            return false;
         }
         return !(allowedMimeTypes && !allowedMimeTypes.includes(spec.type));
      });
   }

   const addFiles = useCallback(
      (newFiles: (File | FileWithPath)[]) => {
         console.log("onDropped", newFiles);
         if (!isAllowed(newFiles)) return;

         const added = newFiles.length;

         // Check max files using the current state, not a stale closure
         setFiles((currentFiles) => {
            let to_drop = 0;

            if (maxItems) {
               const $max = checkMaxReached({
                  maxItems,
                  overwrite,
                  added,
                  current: currentFiles.length,
               });

               if ($max.reject) {
                  if (onRejected) {
                     onRejected(newFiles);
                  } else {
                     console.warn("maxItems reached");
                  }

                  // Return current state unchanged if rejected
                  return currentFiles;
               }

               to_drop = $max.to_drop;
            }

            // drop amount calculated
            const _prev = currentFiles.slice(to_drop);

            // prep new files
            const currentPaths = _prev.map((f) => f.path);
            const filteredFiles: FileState[] = newFiles
               .filter((f) => !("path" in f) || (f.path && !currentPaths.includes(f.path)))
               .map((f) => ({
                  body: f,
                  path: "path" in f ? f.path! : f.name,
                  name: f.name,
                  size: f.size,
                  type: f.type,
                  state: "pending",
                  progress: 0,
               }));

            const updatedFiles =
               flow === "start" ? [...filteredFiles, ..._prev] : [..._prev, ...filteredFiles];

            if (autoUpload && filteredFiles.length > 0) {
               // Schedule upload for the next tick to ensure state is updated
               setTimeout(() => setUploading(true), 0);
            }

            return updatedFiles;
         });
      },
      [autoUpload, flow, maxItems, overwrite],
   );

   const { handleFileInputChange, ref } = useDropzone({
      onDropped: (newFiles: FileWithPath[]) => {
         console.log("onDropped", newFiles);
         addFiles(newFiles);
      },
      onOver: (items) => {
         if (!isAllowed(items)) {
            setIsOver(true, false);
            return;
         }

         const current = getFilesLength();
         const $max = checkMaxReached({
            maxItems,
            overwrite,
            added: items.length,
            current,
         });
         console.log("--files in onOver", current, $max);
         setIsOver(true, !$max.reject);
      },
      onLeave: () => {
         setIsOver(false, false);
      },
   });

   useEffect(() => {
      console.log("files updated");
   }, [files]);

   useEffect(() => {
      if (uploading) {
         (async () => {
            const pendingFiles = files.filter((f) => f.state === "pending");
            if (pendingFiles.length === 0) {
               setUploading(false);
               return;
            } else {
               const uploaded: FileStateWithData[] = [];
               for (const file of pendingFiles) {
                  try {
                     const progress = await uploadFileProgress(file);
                     uploaded.push(progress);
                     onUploaded?.(progress);
                  } catch (e) {
                     handleUploadError(e);
                  }
               }
               setUploading(false);
               onUploadedAll?.(uploaded);
            }
         })();
      }
   }, [uploading]);

   function uploadFileProgress(file: FileState): Promise<FileStateWithData> {
      return new Promise((resolve, reject) => {
         if (!file.body) {
            console.error("File has no body");
            reject();
            return;
         } else if (file.state !== "pending") {
            console.error("File is not pending");
            reject();
            return;
         } else if (file.body instanceof File === false) {
            console.error("File body is not a File instance");
            reject();
            return;
         }

         const uploadInfo = getUploadInfo({ path: file.body.path! });
         console.log("dropzone:uploadInfo", uploadInfo);
         const { url, headers, method = "POST" } = uploadInfo;

         const xhr = new XMLHttpRequest();
         console.log("xhr:url", url);
         const searchParams = new URLSearchParams();
         if (overwrite) {
            searchParams.append("overwrite", "1");
         }

         xhr.open(method, String(url) + "?" + String(searchParams), true);

         if (headers) {
            headers.forEach((value, key) => {
               xhr.setRequestHeader(key, value);
            });
         }

         // Handle progress events
         xhr.upload.addEventListener("progress", (event) => {
            console.log("progress", event.loaded, event.total);
            if (event.lengthComputable) {
               setFileState(file.path, "uploading", event.loaded / event.total);
               const percentComplete = (event.loaded / event.total) * 100;
               console.log(`Progress: ${percentComplete.toFixed(2)}%`);
            } else {
               console.log(
                  "Unable to compute progress information since the total size is unknown",
               );
            }
         });

         xhr.onload = () => {
            console.log("onload", file.path, xhr.status);
            if (xhr.status >= 200 && xhr.status < 300) {
               //setFileState(file.path, "uploaded", 1);
               console.log("Upload complete");

               try {
                  const response = JSON.parse(xhr.responseText);

                  console.log("Response:", file, response);
                  const newState = {
                     ...response.state,
                     progress: 1,
                     state: "uploaded",
                  };

                  setFileState(file.path, newState.state);
                  resolve({ ...response, ...file, ...newState });
               } catch (e) {
                  setFileState(file.path, "uploaded", 1);
                  console.error("Error parsing response", e);
                  reject(e);
               }
            } else {
               setFileState(file.path, "failed", 1);
               console.error("Upload failed with status: ", xhr.status, xhr.statusText);
               reject(xhr);
            }
         };

         xhr.onerror = () => {
            console.error("Error during the upload process.");
         };
         xhr.onloadstart = () => {
            setFileState(file.path, "uploading", 0);
            console.log("loadstart");
         };

         xhr.setRequestHeader("Accept", "application/json");
         xhr.send(file.body);
      });
   }

   const deleteFile = useCallback(async (file: FileState) => {
      console.log("deleteFile", file);
      switch (file.state) {
         case "uploaded":
         case "initial":
            if (window.confirm("Are you sure you want to delete this file?")) {
               console.log('setting state to "deleting"', file);
               setFileState(file.path, "deleting");
               await handleDelete(file);
               removeFile(file.path);
               onDeleted?.(file);
            }
            break;
      }
   }, []);

   const uploadFile = useCallback(async (file: FileState) => {
      const result = await uploadFileProgress(file);
      onUploadedAll?.([result]);
      onUploaded?.(result);
   }, []);

   const openFileInput = useCallback(() => inputRef.current?.click(), [inputRef]);
   const showPlaceholder = useMemo(
      () =>
         Boolean(placeholder?.show === true || !maxItems || (maxItems && files.length < maxItems)),
      [placeholder, maxItems, files.length],
   );

   const renderProps = useMemo(
      () => ({
         store,
         wrapperRef: ref,
         inputProps: {
            ref: inputRef,
            type: "file",
            multiple: !maxItems || maxItems > 1,
            onChange: handleFileInputChange,
         },
         showPlaceholder,
         actions: {
            uploadFile,
            deleteFile,
            openFileInput,
            addFiles,
         },
         dropzoneProps: {
            maxItems,
            placeholder,
            autoUpload,
            flow,
         },
         onClick,
         footer,
      }),
      [maxItems, flow, placeholder, autoUpload, footer],
   ) as unknown as DropzoneRenderProps;

   return (
      <DropzoneContext.Provider value={renderProps}>
         {children ? (
            typeof children === "function" ? (
               children(renderProps)
            ) : (
               children
            )
         ) : (
            <DropzoneInner {...renderProps} />
         )}
      </DropzoneContext.Provider>
   );
}

const DropzoneContext = createContext<DropzoneRenderProps>(undefined!);

export function useDropzoneContext() {
   return useContext(DropzoneContext);
}

export const useDropzoneState = () => {
   const { store } = useDropzoneContext();
   const files = useStore(store, (state) => state.files);
   const isOver = useStore(store, (state) => state.isOver);
   const isOverAccepted = useStore(store, (state) => state.isOverAccepted);
   const uploading = useStore(store, (state) => state.uploading);

   return {
      files,
      isOver,
      isOverAccepted,
      uploading,
   };
};

export const useDropzoneFileState = <R = any>(
   pathOrFile: string | FileState,
   selector: (file: FileState) => R,
): R | undefined => {
   const { store } = useDropzoneContext();
   return useStore(store, (state) => {
      const file =
         typeof pathOrFile === "string"
            ? state.files.find((f) => f.path === pathOrFile)
            : state.files.find((f) => f.path === pathOrFile.path);
      return file ? selector(file) : undefined;
   });
};
