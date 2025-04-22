import type { AppAuthOAuthStrategy, AppAuthSchema } from "auth/auth-schema";
import clsx from "clsx";
import { Type } from "core/utils";
import { Form } from "json-schema-form-react";
import { transform } from "lodash-es";
import type { ComponentPropsWithoutRef } from "react";
import { Button } from "ui/components/buttons/Button";
import { Group, Input, Password, Label } from "ui/components/form/Formy/components";
import { SocialLink } from "./SocialLink";
import type { ValueError } from "@sinclair/typebox/value";
import { type TSchema, Value } from "core/utils";
import type { Validator } from "json-schema-form-react";

class TypeboxValidator implements Validator<ValueError> {
   async validate(schema: TSchema, data: any) {
      return Value.Check(schema, data) ? [] : [...Value.Errors(schema, data)];
   }
}

export type LoginFormProps = Omit<ComponentPropsWithoutRef<"form">, "onSubmit" | "action"> & {
   className?: string;
   formData?: any;
   action: "login" | "register";
   method?: "POST" | "GET";
   auth?: Partial<Pick<AppAuthSchema, "basepath" | "strategies">>;
   buttonLabel?: string;
};

const validator = new TypeboxValidator();
const schema = Type.Object({
   email: Type.String({
      pattern: "^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$",
   }),
   password: Type.String({
      minLength: 8, // @todo: this should be configurable
   }),
});

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
         <Form
            method={method}
            action={password.action}
            {...(props as any)}
            schema={schema}
            validator={validator}
            validationMode="change"
            className={clsx("flex flex-col gap-3 w-full", className)}
         >
            {({ errors, submitting }) => (
               <>
                  <Group>
                     <Label htmlFor="email">Email address</Label>
                     <Input type="email" name="email" />
                  </Group>
                  <Group>
                     <Label htmlFor="password">Password</Label>
                     <Password name="password" />
                  </Group>

                  <Button
                     type="submit"
                     variant="primary"
                     size="large"
                     className="w-full mt-2 justify-center"
                     disabled={errors.length > 0 || submitting}
                  >
                     {buttonLabel}
                  </Button>
               </>
            )}
         </Form>
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
