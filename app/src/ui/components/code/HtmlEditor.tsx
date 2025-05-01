import { Suspense, lazy } from "react";
import { twMerge } from "tailwind-merge";

import type { CodeEditorProps } from "./CodeEditor";
const CodeEditor = lazy(() => import("./CodeEditor"));

export function HtmlEditor({ editable, ...props }: CodeEditorProps) {
   return (
      <Suspense fallback={null}>
         <CodeEditor
            className={twMerge(
               "flex w-full border border-muted bg-white rounded-lg",
               !editable && "opacity-70",
            )}
            editable={editable}
            _extensions={{
               html: true,
            }}
            {...props}
         />
      </Suspense>
   );
}
