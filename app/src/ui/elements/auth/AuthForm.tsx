import type { AppAuthOAuthStrategy, AppAuthSchema } from "auth/auth-schema";
import clsx from "clsx";
import { NativeForm } from "ui/components/form/native-form/NativeForm";
import { transformObject } from "bknd/utils";
import { useEffect, useState, type ComponentPropsWithoutRef, type FormEvent } from "react";
import { Button } from "ui/components/buttons/Button";
import { Group, Input, Password, Label } from "ui/components/form/Formy/components";
import { SocialLink } from "./SocialLink";
import { useAuth } from "bknd/client";
import { Alert } from "ui/components/display/Alert";
import { useLocation } from "wouter";

export type LoginFormProps = Omit<ComponentPropsWithoutRef<"form">, "action"> & {
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
   onSubmit: _onSubmit,
   ...props
}: LoginFormProps) {
   const $auth = useAuth();
   const basepath = auth?.basepath ?? "/api/auth";
   const [error, setError] = useState<string>();
   const [, navigate] = useLocation();
   const password = {
      action: `${basepath}/password/${action}`,
      strategy: auth?.strategies?.password ?? ({ type: "password" } as const),
   };

   const oauth = transformObject(auth?.strategies ?? {}, (value) => {
      return value.type !== "password" ? value.config : undefined;
   }) as Record<string, AppAuthOAuthStrategy>;
   const has_oauth = Object.keys(oauth).length > 0;

   async function onSubmit(
      data: any,
      ctx: { event: FormEvent<HTMLFormElement>; form: HTMLFormElement },
   ) {
      if ($auth?.local) {
         ctx.event.preventDefault();

         const res = await $auth.login(data);
         if ("token" in res) {
            navigate("/");
         } else {
            setError((res as any).error);
            return;
         }
      }

      await _onSubmit?.(ctx.event);
      // submit form
      ctx.form.submit();
   }

   useEffect(() => {
      if ($auth.user) {
         navigate("/");
      }
   }, [$auth.user]);

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
            onSubmit={onSubmit}
            {...(props as any)}
            validateOn="change"
            className={clsx("flex flex-col gap-3 w-full", className)}
         >
            {error && <Alert.Exception message={error} className="justify-center" />}
            <Group>
               <Label htmlFor="email">Email address</Label>
               <Input type="email" name="email" required />
            </Group>
            <Group>
               <Label htmlFor="password">Password</Label>
               <Password name="password" required minLength={1} />
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
