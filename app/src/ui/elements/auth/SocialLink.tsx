import { ucFirstAllSnakeToPascalWithSpaces } from "bknd/utils";
import type { ReactNode } from "react";
import { Button } from "ui/components/buttons/Button";
import type { IconType } from "ui/components/buttons/IconButton";

export type SocialLinkProps = {
   label?: string;
   provider: string;
   icon?: IconType;
   action: "login" | "register";
   method?: "GET" | "POST";
   basepath?: string;
   children?: ReactNode;
};

export function SocialLink({
   label,
   provider,
   icon,
   action,
   method = "POST",
   basepath = "/api/auth",
   children,
}: SocialLinkProps) {
   const url = [basepath, provider, action].join("/");

   return (
      <form method={method} action={url} className="w-full">
         <Button
            type="submit"
            size="large"
            variant="outline"
            className="justify-center w-full"
            IconLeft={icon}
         >
            Continue with {label ?? ucFirstAllSnakeToPascalWithSpaces(provider)}
         </Button>
         {children}
      </form>
   );
}
