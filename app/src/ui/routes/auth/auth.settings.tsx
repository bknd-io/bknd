import clsx from "clsx";
import { isDebug } from "core";
import { TbChevronDown, TbChevronUp } from "react-icons/tb";
import { useBknd } from "ui/client/BkndProvider";
import { useBkndAuth } from "ui/client/schema/auth/use-bknd-auth";
import { Button } from "ui/components/buttons/Button";
import { Icon } from "ui/components/display/Icon";
import { Message } from "ui/components/display/Message";
import {
   Field,
   type FieldProps,
   Form,
   FormDebug,
   Subscribe,
} from "ui/components/form/json-schema-form";
import { useBrowserTitle } from "ui/hooks/use-browser-title";
import * as AppShell from "ui/layouts/AppShell/AppShell";
import { create } from "zustand";
import { combine } from "zustand/middleware";

const useAuthSettingsStore = create(
   combine(
      {
         advanced: [] as string[],
      },
      (set) => ({
         toggleAdvanced: (which: string) =>
            set((state) => ({
               advanced: state.advanced.includes(which)
                  ? state.advanced.filter((w) => w !== which)
                  : [...state.advanced, which],
            })),
      }),
   ),
);

export function AuthSettings(props) {
   useBrowserTitle(["Auth", "Settings"]);

   const { hasSecrets } = useBknd({ withSecrets: true });
   if (!hasSecrets) {
      return <Message.MissingPermission what="Auth Settings" />;
   }

   return <AuthSettingsInternal {...props} />;
}

const formConfig = {
   ignoreKeys: ["roles", "strategies"],
   options: { keepEmpty: true, debug: isDebug() },
};

function AuthSettingsInternal() {
   const { config, schema: _schema, actions, $auth } = useBkndAuth();
   const schema = JSON.parse(JSON.stringify(_schema));

   schema.properties.jwt.required = ["alg"];

   async function onSubmit(data: any) {
      await actions.config.set(data);
   }

   return (
      <Form schema={schema} initialValues={config as any} onSubmit={onSubmit} {...formConfig}>
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
                  Settings
               </AppShell.SectionHeader>
            )}
         </Subscribe>
         <AppShell.Scrollable>
            <Section className="pt-4 pl-0 pb-0">
               <div className="pl-4">
                  <AuthField
                     name="enabled"
                     label="Authentication Enabled"
                     description="Only after enabling authentication, all settings below will take effect."
                     descriptionPlacement="top"
                  />
               </div>
               <div className="flex flex-col gap-6 relative pl-4 pb-2">
                  <Overlay />
                  <AuthField
                     name="guard.enabled"
                     label={
                        <div className="flex flex-row gap-2 items-center">
                           <span>Guard Enabled</span>
                           {!$auth.roles.has_admin && (
                              <Icon.Warning title="No admin roles defined. Enabling the guard will likely block all requests." />
                           )}
                        </div>
                     }
                     disabled={$auth.roles.none}
                     description="When enabled, enforces permissions on all routes. Make sure to create roles first."
                     descriptionPlacement="top"
                  />
                  <AuthField
                     name="allow_register"
                     label="Allow User Registration"
                     description="When enabled, allows users to register autonomously. New users use the default role."
                     descriptionPlacement="top"
                  />
               </div>
            </Section>
            <div className="flex flex-col gap-3 relative mt-3 pb-4">
               <Overlay />
               <AppShell.Separator />
               <Section title="JWT">
                  <AuthField name="jwt.issuer" />
                  <AuthField
                     name="jwt.secret"
                     description="The secret used to sign the JWT token. If not set, a random key will be generated after enabling authentication."
                     advanced="jwt"
                     inputProps={{ type: "password" }}
                  />
                  <AuthField name="jwt.alg" advanced="jwt" />
                  <AuthField name="jwt.expires" advanced="jwt" />
                  <ToggleAdvanced which="jwt" />
               </Section>
               <AppShell.Separator />
               <Section title="Cookie">
                  <AuthField name="cookie.path" advanced="cookie" />
                  <AuthField name="cookie.sameSite" advanced="cookie" />
                  <AuthField name="cookie.secure" advanced="cookie" />
                  <AuthField name="cookie.expires" advanced="cookie" />
                  <AuthField
                     name="cookie.renew"
                     label="Renew Cookie"
                     description="Automatically renew users cookie on every request."
                     descriptionPlacement="top"
                  />
                  <AuthField name="cookie.pathSuccess" advanced="cookie" />
                  <AuthField name="cookie.pathLoggedOut" />
                  <ToggleAdvanced which="cookie" />
               </Section>
            </div>
            <FormDebug />
         </AppShell.Scrollable>
      </Form>
   );
}

const ToggleAdvanced = ({ which }: { which: string }) => {
   const { advanced, toggleAdvanced } = useAuthSettingsStore();
   const show = advanced.includes(which);
   return (
      <Button
         IconLeft={show ? TbChevronUp : TbChevronDown}
         onClick={() => toggleAdvanced(which)}
         variant={show ? "default" : "ghost"}
         className="self-start"
         size="small"
      >
         {show ? "Hide advanced settings" : "Show advanced settings"}
      </Button>
   );
};

//const Overlay = () => null;
const Overlay = () => (
   <Subscribe selector={(state) => ({ enabled: state.data.enabled })}>
      {({ enabled }) =>
         !enabled && (
            <div className="absolute w-full h-full z-50 inset-0 bg-background opacity-90" />
         )
      }
   </Subscribe>
);

function Section(props: {
   children: React.ReactNode;
   className?: string;
   title?: string;
   first?: boolean;
}) {
   const { children, title, className } = props;
   return (
      <>
         <div className={clsx("flex flex-col gap-6 px-4", title && "pt-0", className)}>
            {title && <h3 className="text-lg font-bold">{title}</h3>}
            {children}
         </div>
      </>
   );
}

function AuthField(props: FieldProps & { advanced?: string }) {
   const { advanced, ...rest } = props;
   const showAdvanced = useAuthSettingsStore((state) => state.advanced);
   if (advanced && !showAdvanced.includes(advanced)) return null;

   return <Field {...rest} />;
}
