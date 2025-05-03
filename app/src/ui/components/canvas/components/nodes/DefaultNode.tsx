import type { ElementProps } from "@mantine/core";
import { twMerge } from "tailwind-merge";
import { useTheme } from "ui/client/use-theme";

type TDefaultNodeProps = ElementProps<"div"> & {
   selected?: boolean;
};

export function DefaultNode({ selected, children, className, ...props }: TDefaultNodeProps) {
   const { theme } = useTheme();
   return (
      <div
         {...props}
         className={twMerge(
            "relative w-80 shadow-lg rounded-lg bg-background",
            selected && "ring-4 ring-blue-400/50",
            className,
         )}
      >
         {children}
      </div>
   );
}

type TDefaultNodeHeaderProps = ElementProps<"div"> & {
   label?: string;
};

const Header: React.FC<TDefaultNodeHeaderProps> = ({ className, label, children, ...props }) => (
   <div
      {...props}
      className={twMerge(
         "flex flex-row bg-primary/15 justify-center items-center rounded-tl-lg rounded-tr-lg py-1 px-2 drag-handle",
         className,
      )}
   >
      {children ? (
         children
      ) : (
         <span className="font-semibold opacity-75 font-mono">{label ?? "Untitled node"}</span>
      )}
   </div>
);

const Content: React.FC<ElementProps<"div">> = ({ children, className, ...props }) => (
   <div {...props} className={twMerge("px-2 py-1.5 pb-2 flex flex-col", className)}>
      {children}
   </div>
);

DefaultNode.Header = Header;
DefaultNode.Content = Content;
