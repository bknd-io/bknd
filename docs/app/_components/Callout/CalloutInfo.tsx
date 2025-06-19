import type { ReactNode } from "react";

export function CalloutInfo({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl my-4 px-4 py-3 flex gap-3 border bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/15 dark:border-blue-900 dark:text-blue-100 [&>div>p]:m-0">
      <div className="pt-1.5 text-blue-500 dark:text-blue-100">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M11 9h2V7h-2m1 13c-4.41 0-8-3.59-8-8s3.59-8 8-8s8 3.59 8 8s-3.59 8-8 8m0-18A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2m-1 15h2v-6h-2z" />
        </svg>
      </div>
      <div>
        {title && <span className="font-semibold">{title}</span>}
        {children}
      </div>
    </div>
  );
}
