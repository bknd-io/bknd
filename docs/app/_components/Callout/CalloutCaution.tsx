import type { ReactNode } from "react";

export function CalloutCaution({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl my-4 px-4 py-3 flex gap-3 border bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-900/15 dark:border-yellow-900 dark:text-yellow-100 [&>div>p]:m-0">
      <div className="pt-1.5 text-yellow-500 dark:text-yellow-100">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="-2 -2 24 24"
          fill="currentColor"
        >
          <path d="M10 20C4.477 20 0 15.523 0 10S4.477 0 10 0s10 4.477 10 10s-4.477 10-10 10m0-2a8 8 0 1 0 0-16a8 8 0 0 0 0 16m0-13a1 1 0 0 1 1 1v5a1 1 0 0 1-2 0V6a1 1 0 0 1 1-1m0 10a1 1 0 1 1 0-2a1 1 0 0 1 0 2" />
        </svg>
      </div>
      <div>
        {title && <span className="font-semibold">{title}</span>}
        {children}
      </div>
    </div>
  );
}
