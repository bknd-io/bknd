import { useEffect, useState } from "react";
import { useTheme } from "ui/client/use-theme";
import { cn } from "ui/lib/utils";

export type CodePreviewProps = {
   code: string;
   className?: string;
   lang?: string;
   theme?: string;
   enabled?: boolean;
};

export const CodePreview = ({
   code,
   className,
   lang = "typescript",
   theme: _theme,
   enabled = true,
}: CodePreviewProps) => {
   const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
   const $theme = useTheme();
   const theme = (_theme ?? $theme.theme === "dark") ? "github-dark" : "github-light";

   useEffect(() => {
      if (!enabled) return;

      let cancelled = false;
      setHighlightedHtml(null);

      async function highlightCode() {
         try {
            // Dynamically import Shiki from CDN
            // @ts-expect-error - Dynamic CDN import
            const { codeToHtml } = await import("https://esm.sh/shiki@3.13.0");

            if (cancelled) return;

            const html = await codeToHtml(code, {
               lang,
               theme,
               structure: "inline",
            });

            if (cancelled) return;

            setHighlightedHtml(html);
         } catch (error) {
            console.error("Failed to load Shiki:", error);
            // Fallback to plain text if Shiki fails to load
            if (!cancelled) {
               setHighlightedHtml(code);
            }
         }
      }

      highlightCode();

      return () => {
         cancelled = true;
      };
   }, [code, enabled]);

   if (!highlightedHtml) {
      return <pre className={cn("select-text cursor-text", className)}>{code}</pre>;
   }

   return (
      <pre
         className={cn("select-text cursor-text", className)}
         dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      />
   );
};
