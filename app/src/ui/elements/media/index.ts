import { PreviewWrapperMemoized } from "./DropzoneInner";
import { DropzoneContainer } from "./DropzoneContainer";
import { useDropzoneContext, useDropzoneFileState, useDropzoneState } from "./Dropzone";

export const Media = {
   Dropzone: DropzoneContainer,
   Preview: PreviewWrapperMemoized,
   useDropzone: useDropzoneContext,
   useDropzoneState,
   useDropzoneFileState,
};

export {
   useDropzoneContext as useMediaDropzone,
   useDropzoneState as useMediaDropzoneState,
   useDropzoneFileState as useMediaDropzoneFileState,
};

export type { FileState, FileStateWithData, DropzoneProps, DropzoneRenderProps } from "./Dropzone";
export type { PreviewComponentProps } from "./DropzoneInner";
export type { DropzoneContainerProps } from "./DropzoneContainer";
