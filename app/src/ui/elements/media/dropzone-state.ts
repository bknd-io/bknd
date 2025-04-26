import { createStore } from "zustand";
import { combine } from "zustand/middleware";
import type { FileState } from "./Dropzone";

export const createDropzoneStore = () => {
   return createStore(
      combine(
         {
            files: [] as FileState[],
            isOver: false,
            isOverAccepted: false,
            uploading: false,
         },
         (set, get) => ({
            setFiles: (fn: (files: FileState[]) => FileState[]) =>
               set(({ files }) => ({ files: fn(files) })),
            getFilesLength: () => get().files.length,
            setIsOver: (isOver: boolean, isOverAccepted: boolean) =>
               set({ isOver, isOverAccepted }),
            setUploading: (uploading: boolean) => set({ uploading }),
            setIsOverAccepted: (isOverAccepted: boolean) => set({ isOverAccepted }),
            reset: () => set({ files: [], isOver: false, isOverAccepted: false }),
            addFile: (file: FileState) => set((state) => ({ files: [...state.files, file] })),
            removeFile: (path: string) =>
               set((state) => ({ files: state.files.filter((f) => f.path !== path) })),
            removeAllFiles: () => set({ files: [] }),
            setFileProgress: (path: string, progress: number) =>
               set((state) => ({
                  files: state.files.map((f) => (f.path === path ? { ...f, progress } : f)),
               })),
            setFileState: (path: string, newState: FileState["state"], progress?: number) =>
               set((state) => ({
                  files: state.files.map((f) =>
                     f.path === path
                        ? { ...f, state: newState, progress: progress ?? f.progress }
                        : f,
                  ),
               })),
         }),
      ),
   );
};
