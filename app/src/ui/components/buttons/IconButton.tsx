import type { Icon, IconProps } from "@tabler/icons-react";
import { type ComponentPropsWithoutRef, forwardRef } from "react";
import type { IconType as RI_IconType } from "react-icons";
import { twMerge } from "tailwind-merge";
import { Button, type ButtonProps } from "./Button";

export type IconType =
   | RI_IconType
   | React.ForwardRefExoticComponent<IconProps & React.RefAttributes<Icon>>;

const styles = {
   xs: { className: "p-0.5", size: 13 },
   sm: { className: "p-0.5", size: 15 },
   md: { className: "p-1", size: 18 },
   lg: { className: "p-1.5", size: 22 },
} as const;

interface IconButtonProps extends ComponentPropsWithoutRef<"button"> {
   Icon: IconType;
   iconProps?: Record<string, any>;
   variant?: ButtonProps["variant"];
   size?: keyof typeof styles;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
   ({ Icon, size, variant = "ghost", onClick, disabled, iconProps, tabIndex, ...rest }, ref) => {
      const style = styles[size ?? "md"];

      return (
         <Button
            ref={ref}
            variant={variant}
            iconSize={style.size}
            iconProps={iconProps}
            IconLeft={Icon}
            className={twMerge(style.className, rest.className)}
            onClick={onClick}
            disabled={disabled}
            tabIndex={tabIndex}
         />
      );
   },
);
