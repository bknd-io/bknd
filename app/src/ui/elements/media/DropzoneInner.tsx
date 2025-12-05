import { type ComponentPropsWithoutRef, memo, type ReactNode, useCallback, useMemo } from "react";
import { twMerge } from "tailwind-merge";
import { useRenderCount } from "ui/hooks/use-render-count";
import {
   TbDots,
   TbExternalLink,
   TbFileTypeCsv,
   TbFileText,
   TbJson,
   TbFileTypePdf,
   TbMarkdown,
   TbMusic,
   TbTrash,
   TbUpload,
   TbFileTypeTxt,
   TbFileTypeXml,
   TbZip,
   TbFileTypeSql,
} from "react-icons/tb";
import { Dropdown, type DropdownItem } from "ui/components/overlay/Dropdown";
import { IconButton } from "ui/components/buttons/IconButton";
import { formatNumber } from "bknd/utils";
import type { DropzoneRenderProps, FileState } from "./Dropzone";
import { useDropzoneFileState, useDropzoneState } from "./Dropzone";

function handleUploadError(e: unknown) {
   if (e && e instanceof XMLHttpRequest) {
      const res = JSON.parse(e.responseText) as any;
      alert(`Upload failed with code ${e.status}: ${res.error}`);
   } else {
      alert("Upload failed");
   }
}

export const DropzoneInner = ({
   wrapperRef,
   inputProps,
   showPlaceholder,
   actions: { uploadFile, deleteFile, openFileInput },
   dropzoneProps: { placeholder, flow, maxItems, allowedMimeTypes },
   onClick,
   footer,
}: DropzoneRenderProps) => {
   const { files, isOver, isOverAccepted } = useDropzoneState();
   const Placeholder = showPlaceholder && (
      <UploadPlaceholder onClick={openFileInput} text={placeholder?.text} />
   );

   const uploadHandler = useCallback(
      async (file: { path: string }) => {
         try {
            return await uploadFile(file);
         } catch (e) {
            handleUploadError(e);
         }
      },
      [uploadFile],
   );

   return (
      <div
         ref={wrapperRef}
         className={twMerge(
            "dropzone w-full h-full align-start flex flex-col select-none",
            isOver && isOverAccepted && "bg-green-200/10",
            isOver && !isOverAccepted && "bg-red-200/40 cursor-not-allowed",
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
                     onClick={onClick}
                  />
               ))}
               {flow === "end" && Placeholder}
               {footer}
            </div>
         </div>
      </div>
   );
};

const UploadPlaceholder = ({ onClick, text = "Upload files" }) => {
   return (
      <div
         className="w-[49%] aspect-square md:w-60 flex flex-col border-2 border-dashed border-muted relative justify-center items-center text-primary/30 hover:border-primary/30 hover:text-primary/50 hover:cursor-pointer hover:bg-muted/20 transition-colors duration-200"
         onClick={onClick}
      >
         <span className="">{text}</span>
      </div>
   );
};

type ReducedFile = Omit<FileState, "state" | "progress">;
export type PreviewComponentProps = {
   file: ReducedFile;
   fallback?: (props: { file: ReducedFile }) => ReactNode;
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
   (prev, next) => prev.file.path === next.file.path,
);

type PreviewProps = {
   file: FileState;
   handleUpload: (file: FileState) => Promise<void>;
   handleDelete: (file: FileState) => Promise<void>;
   onClick?: (file: { path: string }) => void;
};
const Preview = memo(
   ({ file: _file, handleUpload, handleDelete, onClick }: PreviewProps) => {
      const rcount = useRenderCount();
      const file = useDropzoneFileState(_file, (file) => {
         const { progress, ...rest } = file;
         return rest;
      });
      if (!file) return null;
      const onClickHandler = useCallback(() => {
         if (onClick) {
            onClick(file);
         }
      }, [onClick, file.path]);

      return (
         <div
            className={twMerge(
               "w-[49%] md:w-60 aspect-square flex flex-col border border-muted relative hover:bg-primary/5 cursor-pointer transition-colors",
               file.state === "failed" && "border-red-500 bg-red-200/20",
               file.state === "deleting" && "opacity-70",
            )}
            onClick={onClickHandler}
         >
            <div className="absolute top-2 right-2">
               <PreviewDropdown
                  file={file as any}
                  handleDelete={handleDelete}
                  handleUpload={handleUpload}
               />
            </div>
            <PreviewUploadProgress file={file} />
            <div className="flex bg-primary/5 aspect-[1/0.78] overflow-hidden items-center justify-center">
               <PreviewWrapperMemoized
                  file={file}
                  fallback={FallbackPreview}
                  className="max-w-full max-h-full"
               />
            </div>
            <div className="flex flex-col px-1.5 py-1">
               <div className="flex flex-row gap-2 items-center">
                  <p className="truncate select-text w-[calc(100%-10px)]">{file.name}</p>
                  <StateIndicator file={file} />
               </div>
               <div className="flex flex-row justify-between text-xs md:text-sm font-mono opacity-50 text-nowrap gap-2">
                  <span className="truncate select-text">{file.type}</span>
                  <span className="whitespace-nowrap">{formatNumber.fileSize(file.size)}</span>
               </div>
            </div>
         </div>
      );
   },
   (prev, next) => prev.file.path === next.file.path && prev.file.state === next.file.state,
);

const PreviewUploadProgress = ({ file: _file }: { file: { path: string } }) => {
   const fileState = useDropzoneFileState(_file.path, (file) => ({
      state: file.state,
      progress: file.progress,
   }));
   if (!fileState) return null;
   if (fileState.state !== "uploading") return null;

   return (
      <div className="absolute w-full top-0 left-0 right-0 h-1">
         <div
            className="bg-blue-600 h-1 transition-all duration-75"
            style={{ width: (fileState.progress * 100).toFixed(0) + "%" }}
         />
      </div>
   );
};

const PreviewDropdown = memo(
   ({
      file: _file,
      handleDelete,
      handleUpload,
   }: {
      file: FileState;
      handleDelete: (file: FileState) => Promise<void>;
      handleUpload: (file: FileState) => Promise<void>;
   }) => {
      const file = useDropzoneFileState(_file.path, (file) => {
         const { progress, ...rest } = file;
         return rest;
      });
      if (!file) return null;

      const dropdownItems = useMemo(
         () =>
            [
               file.state === "uploaded" &&
                  typeof file.body === "string" && {
                     label: "Open",
                     icon: TbExternalLink,
                     onClick: () => {
                        window.open(file.body as string, "_blank");
                     },
                  },
               ["initial", "uploaded"].includes(file.state) && {
                  label: "Delete",
                  destructive: true,
                  icon: TbTrash,
                  onClick: () => handleDelete(file as any),
               },
               ["initial", "pending"].includes(file.state) && {
                  label: "Upload",
                  icon: TbUpload,
                  onClick: () => handleUpload(file as any),
               },
            ] satisfies (DropdownItem | boolean)[],
         [file, handleDelete, handleUpload],
      );
      return (
         <Dropdown items={dropdownItems} position="bottom-end">
            <IconButton Icon={TbDots} />
         </Dropdown>
      );
   },
   (prev, next) => prev.file.path === next.file.path,
);

const StateIndicator = ({ file: _file }: { file: { path: string } }) => {
   const fileState = useDropzoneFileState(_file.path, (file) => file.state);
   if (!fileState) return null;
   if (fileState === "uploaded") {
      return null;
   }

   const color =
      {
         failed: "bg-red-500",
         deleting: "bg-orange-500 animate-pulse",
         uploading: "bg-blue-500 animate-pulse",
      }[fileState] ?? "bg-primary/50";

   return <div className={"w-2 h-2 rounded-full mt-px " + color} title={fileState} />;
};

const ImagePreview = ({
   file,
   ...props
}: { file: ReducedFile } & ComponentPropsWithoutRef<"img">) => {
   const objectUrl = typeof file.body === "string" ? file.body : URL.createObjectURL(file.body);
   return <img {...props} src={objectUrl} />;
};

const VideoPreview = ({
   file,
   ...props
}: { file: ReducedFile } & ComponentPropsWithoutRef<"video">) => {
   const objectUrl = typeof file.body === "string" ? file.body : URL.createObjectURL(file.body);
   return <video {...props} src={objectUrl} />;
};

const Previews = [
   {
      mime: "text/plain",
      Icon: TbFileTypeTxt,
   },
   {
      mime: "text/csv",
      Icon: TbFileTypeCsv,
   },
   {
      mime: /(text|application)\/xml/,
      Icon: TbFileTypeXml,
   },
   {
      mime: "text/markdown",
      Icon: TbMarkdown,
   },
   {
      mime: /^text\/.*$/,
      Icon: TbFileText,
   },
   {
      mime: "application/json",
      Icon: TbJson,
   },
   {
      mime: "application/pdf",
      Icon: TbFileTypePdf,
   },
   {
      mime: /^audio\/.*$/,
      Icon: TbMusic,
   },
   {
      mime: "application/zip",
      Icon: TbZip,
   },
   {
      mime: "application/sql",
      Icon: TbFileTypeSql,
   },
];

const FallbackPreview = ({ file }: { file: ReducedFile }) => {
   const previewIcon = Previews.find((p) =>
      p.mime instanceof RegExp ? p.mime.test(file.type) : p.mime === file.type,
   );
   if (previewIcon) {
      return <previewIcon.Icon className="size-10 text-gray-400" />;
   }
   return (
      <div className="text-xs text-primary/50 text-center font-mono leading-none max-w-[90%] truncate">
         {file.type}
      </div>
   );
};
