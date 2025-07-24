import type { AppAuthOAuthStrategy, AppAuthSchema } from "auth/auth-schema";
import clsx from "clsx";
import { NativeForm } from "ui/components/form/native-form/NativeForm";
import { transform } from "lodash-es";
import type { ComponentPropsWithoutRef } from "react";
import { Button } from "ui/components/buttons/Button";
import { Group, Input, Password, Label } from "ui/components/form/Formy/components";
import { SocialLink } from "./SocialLink";

export type LoginFormProps = Omit<ComponentPropsWithoutRef<"form">, "onSubmit" | "action"> & {
   className?: string;
   formData?: any;
   action: "login" | "register";
   method?: "POST" | "GET";
   auth?: Partial<Pick<AppAuthSchema, "basepath" | "strategies">>;
   buttonLabel?: string;
};

export function AuthForm({
   formData,
   className,
   method = "POST",
   action,
   auth,
   buttonLabel = action === "login" ? "Sign in" : "Sign up",
   ...props
}: LoginFormProps) {
   const basepath = auth?.basepath ?? "/api/auth";
   const password = {
      action: `${basepath}/password/${action}`,
      strategy: auth?.strategies?.password ?? ({ type: "password" } as const),
   };

   const oauth = transform(
      auth?.strategies ?? {},
      (result, value, key) => {
         if (value.type !== "password") {
            result[key] = value.config;
         }
      },
      {},
   ) as Record<string, AppAuthOAuthStrategy>;
   const has_oauth = Object.keys(oauth).length > 0;

   return (
      <div className="flex flex-col gap-4 w-full">
         {has_oauth && (
            <>
               <div>
                  {Object.entries(oauth)?.map(([name, oauth], key) => (
                     <SocialLink
                        provider={name}
                        method={method}
                        basepath={basepath}
                        key={key}
                        action={action}
                     />
                  ))}
               </div>
               <Or />
            </>
         )}
         <NativeForm
            method={method}
            action={password.action}
            {...(props as any)}
            validateOn="change"
            className={clsx("flex flex-col gap-3 w-full", className)}
         >
            <Group>
               <Label htmlFor="email">Email address</Label>
               <Input type="email" name="email" required />
            </Group>
            <Group>
               <Label htmlFor="password">Password</Label>
               <Password name="password" required minLength={8} />
            </Group>

            <Button
               type="submit"
               variant="primary"
               size="large"
               className="w-full mt-2 justify-center"
            >
               {buttonLabel}
            </Button>
         </NativeForm>
      </div>
   );
}

const Or = () => (
   <div className="w-full flex flex-row items-center">
      <div className="relative flex grow">
         <div className="h-px bg-primary/10 w-full absolute top-[50%] z-0" />
      </div>
      <div className="mx-5">or</div>
      <div className="relative flex grow">
         <div className="h-px bg-primary/10 w-full absolute top-[50%] z-0" />
      </div>
   </div>
);
