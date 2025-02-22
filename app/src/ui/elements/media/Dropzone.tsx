import type { DB } from "core";
import {
   type ComponentPropsWithRef,
   type ComponentPropsWithoutRef,
   type RefObject,
   memo,
   useEffect,
   useRef,
   useState
} from "react";
import { TbDots } from "react-icons/tb";
import { twMerge } from "tailwind-merge";
import { IconButton } from "ui/components/buttons/IconButton";
import { Dropdown } from "ui/components/overlay/Dropdown";
import { type FileWithPath, useDropzone } from "./use-dropzone";

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
   wrapperRef: RefObject<HTMLDivElement>;
   inputProps: ComponentPropsWithRef<"input">;
   state: {
      files: FileState[];
      isOver: boolean;
      isOverAccepted: boolean;
      showPlaceholder: boolean;
   };
   actions: {
      uploadFile: (file: FileState) => Promise<void>;
      deleteFile: (file: FileState) => Promise<void>;
      openFileInput: () => void;
   };
   dropzoneProps: Pick<DropzoneProps, "maxItems" | "placeholder" | "autoUpload" | "flow">;
};

export type DropzoneProps = {
   getUploadInfo: (file: FileWithPath) => { url: string; headers?: Headers; method?: string };
   handleDelete: (file: FileState) => Promise<boolean>;
   initialItems?: FileState[];
   flow?: "start" | "end";
   maxItems?: number;
   allowedMimeTypes?: string[];
   overwrite?: boolean;
   autoUpload?: boolean;
   onRejected?: (files: FileWithPath[]) => void;
   onDeleted?: (file: FileState) => void;
   onUploaded?: (files: FileStateWithData[]) => void;
   placeholder?: {
      show?: boolean;
      text?: string;
   };
   children?: (props: DropzoneRenderProps) => JSX.Element;
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
   onUploaded,
   children
}: DropzoneProps) {
   const [files, setFiles] = useState<FileState[]>(initialItems);
   const [uploading, setUploading] = useState<boolean>(false);
   const inputRef = useRef<HTMLInputElement>(null);
   const [isOverAccepted, setIsOverAccepted] = useState(false);

   function isMaxReached(added: number): boolean {
      if (!maxItems) {
         console.log("maxItems is undefined, never reached");
         return false;
      }

      const current = files.length;
      const remaining = maxItems - current;
      console.log("isMaxReached", { added, current, remaining, maxItems, overwrite });

      // if overwrite is set, but added is bigger than max items
      if (overwrite) {
         console.log("added > maxItems, stop?", added > maxItems);
         return added > maxItems;
      }
      console.log("remaining > added, stop?", remaining > added);
      // or remaining doesn't suffice, stop
      return added > remaining;
   }

   function isAllowed(i: DataTransferItem | DataTransferItem[] | File | File[]): boolean {
      const items = Array.isArray(i) ? i : [i];
      const specs = items.map((item) => ({
         kind: "kind" in item ? item.kind : "file",
         type: item.type,
         size: "size" in item ? item.size : 0
      }));

      return specs.every((spec) => {
         if (spec.kind !== "file") {
            return false;
         }
         return !(allowedMimeTypes && !allowedMimeTypes.includes(spec.type));
      });
   }

   const { isOver, handleFileInputChange, ref } = useDropzone({
      onDropped: (newFiles: FileWithPath[]) => {
         if (!isAllowed(newFiles)) return;

         let to_drop = 0;
         const added = newFiles.length;

         if (maxItems) {
            if (isMaxReached(added)) {
               if (onRejected) {
                  onRejected(newFiles);
               } else {
                  console.warn("maxItems reached");
               }

               return;
            }

            to_drop = added;
         }

         console.log("files", newFiles, { to_drop });
         setFiles((prev) => {
            // drop amount calculated
            const _prev = prev.slice(to_drop);

            // prep new files
            const currentPaths = _prev.map((f) => f.path);
            const filteredFiles: FileState[] = newFiles
               .filter((f) => f.path && !currentPaths.includes(f.path))
               .map((f) => ({
                  body: f,
                  path: f.path!,
                  name: f.name,
                  size: f.size,
                  type: f.type,
                  state: "pending",
                  progress: 0
               }));

            return flow === "start" ? [...filteredFiles, ..._prev] : [..._prev, ...filteredFiles];
         });

         if (autoUpload) {
            setUploading(true);
         }
      },
      onOver: (items) => {
         if (!isAllowed(items)) {
            setIsOverAccepted(false);
            return;
         }

         const max_reached = isMaxReached(items.length);
         setIsOverAccepted(!max_reached);
      },
      onLeave: () => {
         setIsOverAccepted(false);
      }
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
                     uploaded.push(await uploadFileProgress(file));
                  } catch (e) {
                     handleUploadError(e);
                  }
               }
               setUploading(false);
               onUploaded?.(uploaded);
            }
         })();
      }
   }, [uploading]);

   function setFileState(path: string, state: FileState["state"], progress?: number) {
      setFiles((prev) =>
         prev.map((f) => {
            //console.log("compare", f.path, path, f.path === path);
            if (f.path === path) {
               return {
                  ...f,
                  state,
                  progress: progress ?? f.progress
               };
            }
            return f;
         })
      );
   }

   function replaceFileState(prevPath: string, newState: Partial<FileState>) {
      setFiles((prev) =>
         prev.map((f) => {
            if (f.path === prevPath) {
               return {
                  ...f,
                  ...newState
               };
            }
            return f;
         })
      );
   }

   function removeFileFromState(path: string) {
      setFiles((prev) => prev.filter((f) => f.path !== path));
   }

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

         const uploadInfo = getUploadInfo(file.body);
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
                  "Unable to compute progress information since the total size is unknown"
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
                     state: "uploaded"
                  };

                  replaceFileState(file.path, newState);
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

   async function deleteFile(file: FileState) {
      console.log("deleteFile", file);
      switch (file.state) {
         case "uploaded":
         case "initial":
            if (window.confirm("Are you sure you want to delete this file?")) {
               console.log('setting state to "deleting"', file);
               setFileState(file.path, "deleting");
               await handleDelete(file);
               removeFileFromState(file.path);
               onDeleted?.(file);
            }
            break;
      }
   }

   async function uploadFile(file: FileState) {
      const result = await uploadFileProgress(file);
      onUploaded?.([result]);
   }

   const openFileInput = () => inputRef.current?.click();
   const showPlaceholder = Boolean(
      placeholder?.show === true || !maxItems || (maxItems && files.length < maxItems)
   );

   const renderProps: DropzoneRenderProps = {
      wrapperRef: ref,
      inputProps: {
         ref: inputRef,
         type: "file",
         multiple: !maxItems || maxItems > 1,
         onChange: handleFileInputChange
      },
      state: {
         files,
         isOver,
         isOverAccepted,
         showPlaceholder
      },
      actions: {
         uploadFile,
         deleteFile,
         openFileInput
      },
      dropzoneProps: {
         maxItems,
         placeholder,
         autoUpload,
         flow
      }
   };

   return children ? children(renderProps) : <DropzoneInner {...renderProps} />;
}

const DropzoneInner = ({
   wrapperRef,
   inputProps,
   state: { files, isOver, isOverAccepted, showPlaceholder },
   actions: { uploadFile, deleteFile, openFileInput },
   dropzoneProps: { placeholder, flow }
}: DropzoneRenderProps) => {
   const Placeholder = showPlaceholder && (
      <UploadPlaceholder onClick={openFileInput} text={placeholder?.text} />
   );

   async function uploadHandler(file: FileState) {
      try {
         return await uploadFile(file);
      } catch (e) {
         handleUploadError(e);
      }
   }

   return (
      <div
         ref={wrapperRef}
         className={twMerge(
            "dropzone w-full h-full align-start flex flex-col select-none",
            isOver && isOverAccepted && "bg-green-200/10",
            isOver && !isOverAccepted && "bg-red-200/40 cursor-not-allowed"
         )}
      >
         <div className="hidden">
            <input {...inputProps} />
         </div>
         <div className="flex flex-1 flex-col">
            <div className="flex flex-row flex-wrap gap-2 md:gap-3">
               {flow === "start" && Placeholder}
               {files.map((file) => (
                  <Preview
                     key={file.path}
                     file={file}
                     handleUpload={uploadHandler}
                     handleDelete={deleteFile}
                  />
               ))}
               {flow === "end" && Placeholder}
            </div>
         </div>
      </div>
   );
};

const UploadPlaceholder = ({ onClick, text = "Upload files" }) => {
   return (
      <div
         className="w-[49%] aspect-[1/0.9] md:w-60 flex flex-col border-2 border-dashed border-muted relative justify-center items-center text-primary/30 hover:border-primary/30 hover:text-primary/50 hover:cursor-pointer hover:bg-muted/20 transition-colors duration-200"
         onClick={onClick}
      >
         <span className="">{text}</span>
      </div>
   );
};

export type PreviewComponentProps = {
   file: FileState;
   fallback?: (props: { file: FileState }) => JSX.Element;
   className?: string;
   onClick?: () => void;
   onTouchStart?: () => void;
};

const Wrapper = ({ file, fallback, ...props }: PreviewComponentProps) => {
   if (file.type.startsWith("image/")) {
      return <ImagePreview {...props} file={file} />;
   }

   if (file.type.startsWith("video/")) {
      return <VideoPreview {...props} file={file} />;
   }

   return fallback ? fallback({ file }) : null;
};
export const PreviewWrapperMemoized = memo(
   Wrapper,
   (prev, next) => prev.file.path === next.file.path
);

type PreviewProps = {
   file: FileState;
   handleUpload: (file: FileState) => Promise<void>;
   handleDelete: (file: FileState) => Promise<void>;
};
const Preview: React.FC<PreviewProps> = ({ file, handleUpload, handleDelete }) => {
   const dropdownItems = [
      ["initial", "uploaded"].includes(file.state) && {
         label: "Delete",
         onClick: () => handleDelete(file)
      },
      ["initial", "pending"].includes(file.state) && {
         label: "Upload",
         onClick: () => handleUpload(file)
      }
   ];

   return (
      <div
         className={twMerge(
            "w-[49%] md:w-60 flex flex-col border border-muted relative",
            file.state === "failed" && "border-red-500 bg-red-200/20",
            file.state === "deleting" && "opacity-70"
         )}
      >
         <div className="absolute top-2 right-2">
            <Dropdown items={dropdownItems} position="bottom-end">
               <IconButton Icon={TbDots} />
            </Dropdown>
         </div>
         {file.state === "uploading" && (
            <div className="absolute w-full top-0 left-0 right-0 h-1">
               <div
                  className="bg-blue-600 h-1 transition-all duration-75"
                  style={{ width: (file.progress * 100).toFixed(0) + "%" }}
               />
            </div>
         )}
         <div className="flex bg-primary/5 aspect-[1/0.8] overflow-hidden items-center justify-center">
            <PreviewWrapperMemoized
               file={file}
               fallback={FallbackPreview}
               className="max-w-full max-h-full"
            />
         </div>
         <div className="flex flex-col px-1.5 py-1">
            <p className="truncate select-text">{file.name}</p>
            <div className="flex flex-row justify-between text-sm font-mono opacity-50 text-nowrap gap-2">
               <span className="truncate select-text">{file.type}</span>
               <span>{(file.size / 1024).toFixed(1)} KB</span>
            </div>
         </div>
      </div>
   );
};

const ImagePreview = ({
   file,
   ...props
}: { file: FileState } & ComponentPropsWithoutRef<"img">) => {
   const objectUrl = typeof file.body === "string" ? file.body : URL.createObjectURL(file.body);
   return <img {...props} src={objectUrl} />;
};

const VideoPreview = ({
   file,
   ...props
}: { file: FileState } & ComponentPropsWithoutRef<"video">) => {
   const objectUrl = typeof file.body === "string" ? file.body : URL.createObjectURL(file.body);
   return <video {...props} src={objectUrl} />;
};

const FallbackPreview = ({ file }: { file: FileState }) => {
   return <div className="text-xs text-primary/50 text-center">{file.type}</div>;
};
