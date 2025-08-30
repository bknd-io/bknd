import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

export function Wrapper(props: HTMLAttributes<HTMLDivElement>) {
   return (
      <div
         {...props}
         className={cn(
            "rounded-lg bg-radial-[at_bottom] from-fd-primary/10 p-4 border bg-origin-border border-fd-accent-primary/10 prose-no-margin dark:bg-black/20",
            props.className,
         )}
      >
         {props.children}
      </div>
   );
}
