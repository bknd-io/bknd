import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export interface CollapsibleListRootProps extends React.HTMLAttributes<HTMLDivElement> {}

const Root = ({ className, ...props }: CollapsibleListRootProps) => (
   <div className={twMerge("flex flex-col gap-2 max-w-4xl", className)} {...props} />
);

export interface CollapsibleListItemProps extends React.HTMLAttributes<HTMLDivElement> {
   hasError?: boolean;
   disabled?: boolean;
}

const Item = ({ className, hasError, disabled, ...props }: CollapsibleListItemProps) => (
   <div
      className={twMerge(
         "flex flex-col border border-muted rounded bg-background",
         hasError && "border-error",
         className,
      )}
      {...props}
   />
);

export interface CollapsibleListPreviewProps extends React.HTMLAttributes<HTMLDivElement> {
   left?: ReactNode;
   right?: ReactNode;
}

const Preview = ({ className, left, right, children, ...props }: CollapsibleListPreviewProps) => (
   <div
      {...props}
      className={twMerge("flex flex-row justify-between p-3 gap-3 items-center", className)}
   >
      {left && <div className="flex flex-row items-center p-2 bg-primary/5 rounded">{left}</div>}
      <div className="font-mono flex-grow flex flex-row gap-3">{children}</div>
      {right && <div className="flex flex-row gap-4 items-center">{right}</div>}
   </div>
);

export interface CollapsibleListDetailProps extends React.HTMLAttributes<HTMLDivElement> {
   open?: boolean;
}

const Detail = ({ className, open, ...props }: CollapsibleListDetailProps) =>
   open && (
      <div
         {...props}
         className={twMerge(
            "flex flex-col border-t border-t-muted px-4 pt-3 pb-4 bg-lightest/50 gap-4",
            className,
         )}
      />
   );

export const CollapsibleList = {
   Root,
   Item,
   Preview,
   Detail,
};
