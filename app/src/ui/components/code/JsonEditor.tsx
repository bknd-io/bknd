import { Suspense, lazy, useState } from "react";
import { twMerge } from "tailwind-merge";
import type { CodeEditorProps } from "./CodeEditor";
import { useDebouncedCallback } from "@mantine/hooks";
const CodeEditor = lazy(() => import("./CodeEditor"));

export type JsonEditorProps = Omit<CodeEditorProps, "value" | "onChange"> & {
   value?: object;
   onChange?: (value: object) => void;
   emptyAs?: "null" | "undefined";
};

export function JsonEditor({
   editable,
   className,
   value,
   onChange,
   onBlur,
   emptyAs = "undefined",
   ...props
}: JsonEditorProps) {
   const [editorValue, setEditorValue] = useState<string | null | undefined>(
      JSON.stringify(value, null, 2),
   );
   const handleChange = useDebouncedCallback((given: string) => {
      const value = given === "" ? (emptyAs === "null" ? null : undefined) : given;
      try {
         setEditorValue(value);
         onChange?.(value ? JSON.parse(value) : value);
      } catch (e) {}
   }, 500);
   const handleBlur = (e) => {
      setEditorValue(JSON.stringify(value, null, 2));
      onBlur?.(e);
   };
   return (
      <Suspense fallback={null}>
         <CodeEditor
            className={twMerge(
               "flex w-full border border-muted",
               !editable && "opacity-70",
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
