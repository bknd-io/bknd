import type React from "react";
import { Children } from "react";
import { forwardRef } from "react";
import { twMerge } from "tailwind-merge";
import { Link } from "ui/components/wouter/Link";

const sizes = {
   small: "px-2 py-1.5 rounded-md gap-1 text-sm",
   default: "px-3 py-2.5 rounded-md gap-1.5",
   large: "px-4 py-3 rounded-md gap-2.5 text-lg",
};

const iconSizes = {
   small: 12,
   default: 16,
   large: 20,
};

const styles = {
   default: "bg-primary/5 hover:bg-primary/10 link text-primary/70",
   primary: "bg-primary hover:bg-primary/80 link text-background",
   ghost: "bg-transparent hover:bg-primary/5 link text-primary/70",
   outline: "border border-primary/20 bg-transparent hover:bg-primary/5 link text-primary/80",
   red: "dark:bg-red-950 dark:hover:bg-red-900 bg-red-100 hover:bg-red-200 link text-primary/70",
   subtlered:
      "dark:text-red-700 text-red-700 dark:hover:bg-red-900 dark:hover:text-red-200 bg-transparent hover:bg-red-50 link",
};

export type BaseProps = {
   className?: string;
   children?: React.ReactNode;
   IconLeft?: React.ComponentType<any>;
   IconRight?: React.ComponentType<any>;
   iconSize?: number;
   iconProps?: Record<string, any>;
   size?: keyof typeof sizes;
   variant?: keyof typeof styles;
   labelClassName?: string;
   "data-testid"?: string;
};

const Base = ({
   children,
   size,
   variant,
   IconLeft,
   IconRight,
   iconSize = iconSizes[size ?? "default"],
   iconProps,
   labelClassName,
   ...props
}: BaseProps) => ({
   ...props,
   className: twMerge(
      "flex flex-row flex-nowrap items-center !font-semibold disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-[opacity,background-color,color,border-color]",
      sizes[size ?? "default"],
      styles[variant ?? "default"],
      props.className,
   ),
   children: (
      <>
         {IconLeft && <IconLeft size={iconSize} {...iconProps} />}
         {children && Children.count(children) === 1 ? (
            <span className={twMerge("leading-none", labelClassName)}>{children}</span>
         ) : (
            children
         )}
         {IconRight && <IconRight size={iconSize} {...iconProps} />}
      </>
   ),
});

export type ButtonProps = React.ComponentPropsWithoutRef<"button"> & BaseProps;
export const Button = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => (
   <button type="button" ref={ref} {...Base(props)} />
));

export type ButtonLinkProps = React.ComponentPropsWithoutRef<"a"> & BaseProps & { href: string };
export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>((props, ref) => (
   <Link ref={ref} href="#" {...Base(props)} />
));
