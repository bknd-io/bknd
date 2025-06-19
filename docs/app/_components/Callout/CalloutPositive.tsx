import type { ReactNode } from "react";

export function CalloutPositive({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl my-4 px-4 py-3 flex gap-3 border bg-green-50 border-green-200 text-green-900 dark:bg-green-900/15 dark:border-green-900 dark:text-green-100 [&>div>p]:m-0">
      <div className="pt-1.5 text-green-500 dark:text-green-100">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <g fill="none" fillRule="evenodd">
            <path d="m12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035q-.016-.005-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.017-.018m.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093q.019.005.029-.008l.004-.014l-.034-.614q-.005-.018-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01z" />
            <path
              fill="currentColor"
              d="M21.546 5.111a1.5 1.5 0 0 1 0 2.121L10.303 18.475a1.6 1.6 0 0 1-2.263 0L2.454 12.89a1.5 1.5 0 1 1 2.121-2.121l4.596 4.596L19.424 5.111a1.5 1.5 0 0 1 2.122 0"
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
