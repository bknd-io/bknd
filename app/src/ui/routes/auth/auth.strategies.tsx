import { isDebug } from "core";
import { autoFormatString } from "core/utils";
import { type ChangeEvent, useState } from "react";
import {
   TbAt,
   TbBrandAppleFilled,
   TbBrandDiscordFilled,
   TbBrandFacebookFilled,
   TbBrandGithubFilled,
   TbBrandGoogleFilled,
   TbBrandInstagram,
   TbBrandOauth,
   TbBrandX,
   TbSettings,
} from "react-icons/tb";
import { twMerge } from "tailwind-merge";
import { useBknd } from "ui/client/bknd";
import { useBkndAuth } from "ui/client/schema/auth/use-bknd-auth";
import { Button } from "ui/components/buttons/Button";
import { IconButton } from "ui/components/buttons/IconButton";
import { Message } from "ui/components/display/Message";
import {
   Field,
   Form,
   FormContextOverride,
   FormDebug,
   HiddenField,
   ObjectField,
   Subscribe,
   useDerivedFieldContext,
   useFormError,
   useFormValue,
} from "ui/components/form/json-schema-form";
import { useBrowserTitle } from "ui/hooks/use-browser-title";
import * as AppShell from "../../layouts/AppShell/AppShell";

export function AuthStrategiesList(props) {
   useBrowserTitle(["Auth", "Strategies"]);

   const {
      hasSecrets,
      config: {
         auth: { enabled },
      },
   } = useBknd({ withSecrets: true });
   if (!hasSecrets) {
      return <Message.MissingPermission what="Auth Strategies" />;
   } else if (!enabled) {
      return <Message.NotEnabled description="Enable Auth first." />;
   }

   return <AuthStrategiesListInternal {...props} />;
}

const formOptions = {
   keepEmpty: true,
   debug: isDebug(),
};

function AuthStrategiesListInternal() {
   const $auth = useBkndAuth();
   const config = $auth.config.strategies;
   const schema = $auth.schema.properties.strategies;
   const schemas = Object.fromEntries(
      // @ts-ignore
      $auth.schema.properties.strategies.additionalProperties.anyOf.map((s) => [
         s.properties.type.const,
         s,
      ]),
   );

   async function handleSubmit(data: any) {
      await $auth.actions.config.set({ strategies: data });
   }

   return (
      <Form schema={schema} initialValues={config} onSubmit={handleSubmit} options={formOptions}>
         <Subscribe
            selector={(state) => ({
               dirty: state.dirty,
               errors: state.errors.length > 0,
               submitting: state.submitting,
            })}
         >
            {({ dirty, errors, submitting }) => (
               <AppShell.SectionHeader
                  className="pl-4"
                  right={
                     <Button
                        variant="primary"
                        type="submit"
                        disabled={!dirty || errors || submitting}
                     >
                        Update
                     </Button>
                  }
               >
                  Strategies
               </AppShell.SectionHeader>
            )}
         </Subscribe>
         <AppShell.Scrollable>
            <div className="flex flex-col p-4 gap-4">
               <p className="opacity-70">
                  Allow users to sign in or sign up using different strategies.
               </p>
               <div className="flex flex-col gap-2 max-w-4xl">
                  <Strategy type="password" name="password" />
                  <Strategy type="oauth" name="google" />
                  <Strategy type="oauth" name="github" />
                  <Strategy type="oauth" name="facebook" unavailable />
                  <Strategy type="oauth" name="x" unavailable />
                  <Strategy type="oauth" name="instagram" unavailable />
                  <Strategy type="oauth" name="apple" unavailable />
                  <Strategy type="oauth" name="discord" unavailable />
               </div>
            </div>
            <FormDebug />
         </AppShell.Scrollable>
      </Form>
   );
}

type StrategyProps = {
   type: "password" | "oauth" | "custom_oauth";
   name: string;
   unavailable?: boolean;
};

const Strategy = ({ type, name, unavailable }: StrategyProps) => {
   const errors = useFormError(name, { strict: true });
   const $auth = useBkndAuth();
   const schemas = Object.fromEntries(
      // @ts-ignore
      $auth.schema.properties.strategies.additionalProperties.anyOf.map((s) => [
         s.properties.type.const,
         s,
      ]),
   );
   const schema = schemas[type];
   const [open, setOpen] = useState(false);

   if (!schema) return null;

   return (
      <FormContextOverride schema={schema} prefix={name}>
         <div
            className={twMerge(
               "flex flex-col border border-muted rounded bg-background",
               unavailable && "opacity-20 pointer-events-none cursor-not-allowed",
               errors.length > 0 && "border-red-500",
            )}
         >
            <div className="flex flex-row justify-between p-3 gap-3 items-center">
               <div className="flex flex-row items-center p-2 bg-primary/5 rounded">
                  <StrategyIcon type={type} provider={name} />
               </div>
               <div className="font-mono flex-grow flex flex-row gap-3">
                  <span className="leading-none">{autoFormatString(name)}</span>
               </div>
               <div className="flex flex-row gap-4 items-center">
                  <StrategyToggle type={type} />
                  <IconButton
                     Icon={TbSettings}
                     size="lg"
                     iconProps={{ strokeWidth: 1.5 }}
                     variant={open ? "primary" : "ghost"}
                     onClick={() => setOpen((o) => !o)}
                  />
               </div>
            </div>
            {open && (
               <div
                  className={twMerge(
                     "flex flex-col border-t border-t-muted px-4 pt-3 pb-4 bg-lightest/50 gap-4",
                  )}
               >
                  <StrategyForm type={type} name={name} />
               </div>
            )}
         </div>
      </FormContextOverride>
   );
};

const StrategyToggle = ({ type }: { type: StrategyProps["type"] }) => {
   const ctx = useDerivedFieldContext("");
   const { value } = useFormValue("");

   function handleToggleChange(e: ChangeEvent<HTMLInputElement>) {
      const checked = e.target.value;
      const value_keys = Object.keys(value ?? {});
      const can_remove =
         value_keys.length === 0 || (value_keys.length === 1 && value_keys[0] === "enabled");

      if (!checked && can_remove) {
         ctx.deleteValue(ctx.path);
      } else {
         ctx.setValue([ctx.path, "enabled"].join("."), checked);
      }
   }

   return <Field name="enabled" label={false} required onChange={handleToggleChange} />;
};

const StrategyIcon = ({ type, provider }: { type: StrategyProps["type"]; provider?: string }) => {
   if (type === "password") {
      return <TbAt className="size-5" />;
   }

   if (provider && provider in OAUTH_BRANDS) {
      const BrandIcon = OAUTH_BRANDS[provider];
      return <BrandIcon className="size-5" />;
   }

   return <TbBrandOauth className="size-5" />;
};

const OAUTH_BRANDS = {
   google: TbBrandGoogleFilled,
   github: TbBrandGithubFilled,
   facebook: TbBrandFacebookFilled,
   x: TbBrandX,
   instagram: TbBrandInstagram,
   apple: TbBrandAppleFilled,
   discord: TbBrandDiscordFilled,
};

const StrategyForm = ({ type, name }: Pick<StrategyProps, "type" | "name">) => {
   let Component = (p: any) => (
      <ObjectField path="" wrapperProps={{ wrapper: "group", label: false }} />
   );
   switch (type) {
      case "password":
         Component = StrategyPasswordForm;
         break;
      case "oauth":
         Component = StrategyOAuthForm;
         break;
   }

   return (
      <>
         <HiddenField name="type" inputProps={{ disabled: true, defaultValue: type }} />
         <Component type={type} name={name} />
      </>
   );
};

const StrategyPasswordForm = () => {
   return <ObjectField path="config" wrapperProps={{ wrapper: "group", label: false }} />;
};

const StrategyOAuthForm = ({ type, name }: Pick<StrategyProps, "type" | "name">) => {
   return (
      <>
         <HiddenField name="config.name" inputProps={{ disabled: true, defaultValue: name }} />
         <Field name="config.client.client_id" required inputProps={{ type: "password" }} />
         <Field name="config.client.client_secret" required inputProps={{ type: "password" }} />
      </>
   );
};
