import type { ReactNode } from "react";

export function CalloutDanger({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl my-4 px-4 py-3 flex gap-3 border bg-red-50 border-red-200 text-red-900 dark:bg-red-900/15 dark:border-red-900 dark:text-red-100 [&>div>p]:m-0">
      <div className="pt-1.5 text-red-500 dark:text-red-100">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <g>
            <path d="M16.34 9.322a1 1 0 1 0-1.364-1.463l-2.926 2.728L9.322 7.66A1 1 0 0 0 7.86 9.024l2.728 2.926l-2.927 2.728a1 1 0 1 0 1.364 1.462l2.926-2.727l2.728 2.926a1 1 0 1 0 1.462-1.363l-2.727-2.926z" />
            <path
              fillRule="evenodd"
              d="M1 12C1 5.925 5.925 1 12 1s11 4.925 11 11s-4.925 11-11 11S1 18.075 1 12m11 9a9 9 0 1 1 0-18a9 9 0 0 1 0 18"
              clipRule="evenodd"
            />
          </g>
        </svg>
      </div>
      <div>
        {title && <span className="font-semibold">{title}</span>}
        {children}
      </div>
    </div>
  );
}
