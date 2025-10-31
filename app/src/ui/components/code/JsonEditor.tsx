import { Suspense, lazy, useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import type { CodeEditorProps } from "./CodeEditor";
import { useDebouncedCallback } from "@mantine/hooks";
const CodeEditor = lazy(() => import("./CodeEditor"));

export type JsonEditorProps = Omit<CodeEditorProps, "value" | "onChange"> & {
   value?: object;
   onChange?: (value: object) => void;
   emptyAs?: any;
   onInvalid?: (error: Error) => void;
};

export function JsonEditor({
   editable,
   className,
   value,
   onChange,
   onBlur,
   emptyAs = undefined,
   onInvalid,
   ...props
}: JsonEditorProps) {
   const [editorValue, setEditorValue] = useState<string | null | undefined>(
      value ? JSON.stringify(value, null, 2) : emptyAs,
   );
   const [error, setError] = useState<boolean>(false);
   const handleChange = useDebouncedCallback((given: string) => {
      try {
         setError(false);
         onChange?.(given ? JSON.parse(given) : emptyAs);
      } catch (e) {
         onInvalid?.(e as Error);
         setError(true);
      }
   }, 250);
   const handleBlur = (e) => {
      try {
         const formatted = JSON.stringify(value, null, 2);
         setEditorValue(formatted);
      } catch (e) {}

      onBlur?.(e);
   };

   useEffect(() => {
      if (!editorValue) {
         setEditorValue(value ? JSON.stringify(value, null, 2) : emptyAs);
      }
   }, [value]);

   return (
      <Suspense fallback={null}>
         <CodeEditor
            className={twMerge(
               "flex w-full border border-muted",
               !editable && "opacity-70",
               error && "border-red-500",
               className,
            )}
            editable={editable}
            _extensions={{ json: true }}
            value={editorValue ?? undefined}
            onChange={handleChange}
            onBlur={handleBlur}
            {...props}
         />
      </Suspense>
   );
}
