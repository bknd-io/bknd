import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { type FileWithPath, fromEvent } from "./file-selector";

type DropzoneProps = {
   onDropped: (files: FileWithPath[]) => void;
   onOver?: (items: DataTransferItem[], event: DragEvent) => void;
   onLeave?: () => void;
};

const events = {
   enter: ["dragenter", "dragover", "dragstart"] as const,
   leave: ["dragleave", "drop"] as const
};
const allEvents = [...events.enter, ...events.leave];

export function useDropzone({ onDropped, onOver, onLeave }: DropzoneProps) {
   const [isOver, setIsOver] = useState(false);
   const ref = useRef<HTMLDivElement>(null);
   const onOverCalled = useRef(false);

   // Prevent default behavior (Prevent file from being opened)
   const preventDefaults = useCallback((e: Event) => {
      e.preventDefault();
      e.stopPropagation();
   }, []);

   const toggleHighlight = useCallback(async (e: DragEvent) => {
      const _isOver = events.enter.includes(e.type as any);
      if (onOver && _isOver !== isOver && !onOverCalled.current) {
         onOver((await fromEvent(e)) as DataTransferItem[], e);
         onOverCalled.current = true;
      }

      setIsOver(_isOver);

      if (_isOver === false && onOverCalled.current) {
         onOverCalled.current = false;
         onLeave?.();
      }
   }, []);

   const handleDrop = useCallback(
      async (e: DragEvent) => {
         const files = await fromEvent(e);
         onDropped?.(files as any);
         onOverCalled.current = false;
      },
      [onDropped]
   );

   const handleFileInputChange = useCallback(
      async (e: ChangeEvent<HTMLInputElement>) => {
         const files = await fromEvent(e);
         onDropped?.(files as any);
      },
      [onDropped]
   );

   useEffect(() => {
      const el: HTMLDivElement = ref.current!;

      allEvents.forEach((eventName) => {
         el.addEventListener(eventName, preventDefaults);
         el.addEventListener(eventName, toggleHighlight);
      });

      // Handle dropped files
      el.addEventListener("drop", handleDrop);

      return () => {
         allEvents.forEach((eventName) => {
            el.removeEventListener(eventName, preventDefaults);
            el.removeEventListener(eventName, toggleHighlight);
         });
         el.removeEventListener("drop", handleDrop);
      };
   }, []);

   return { ref, isOver, fromEvent, onDropped, handleFileInputChange };
}

export type { FileWithPath };
