import { IconBrandAws, IconBrandCloudflare, IconCloud, IconServer } from "@tabler/icons-react";
import { isDebug } from "core/env";
import { autoFormatString } from "core/utils";
import { twMerge } from "tailwind-merge";
import { useBknd } from "ui/client/BkndProvider";
import { useBkndMedia } from "ui/client/schema/media/use-bknd-media";
import { Button } from "ui/components/buttons/Button";
import { Alert } from "ui/components/display/Alert";
import { Message } from "ui/components/display/Message";
import * as Formy from "ui/components/form/Formy";
import {
   AnyOf,
   Field,
   Form,
   FormContextOverride,
   FormDebug,
   ObjectField,
   Subscribe,
   useFormError,
} from "ui/components/form/json-schema-form";
import { useBrowserTitle } from "ui/hooks/use-browser-title";
import * as AppShell from "ui/layouts/AppShell/AppShell";
import { testIds } from "ui/lib/config";

export function MediaSettings(props) {
   useBrowserTitle(["Media", "Settings"]);

   const { hasSecrets } = useBknd({ withSecrets: true });
   if (!hasSecrets) {
      return <Message.MissingPermission what="Media Settings" />;
   }

   return <MediaSettingsInternal {...props} />;
}

const formConfig = {
   ignoreKeys: ["entity_name", "basepath"],
   options: { debug: isDebug(), keepEmpty: true },
};

function MediaSettingsInternal() {
   const { config, schema: _schema, actions } = useBkndMedia();
   const schema = JSON.parse(JSON.stringify(_schema));

   schema.if = { properties: { enabled: { const: true } } };
   // biome-ignore lint/suspicious/noThenProperty: <explanation>
   schema.then = { required: ["adapter"] };

   async function onSubmit(data: any) {
      console.log("submit", data);
      await actions.config.patch(data);
   }

   return (
      <>
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
               <RootFormError />
               <div className="flex flex-col gap-3 p-3">
                  <Field
                     name="enabled"
                     inputProps={{ "data-testId": testIds.media.switchEnabled }}
                  />
                  <div className="flex flex-col gap-3 relative">
                     <Overlay />
                     <Field name="storage.body_max_size" label="Storage Body Max Size" />
                  </div>
               </div>
               <AppShell.Separator />
               <div className="flex flex-col gap-3 p-3 relative">
                  <Overlay />
                  <AnyOf.Root path="adapter">
                     <Adapters />
                  </AnyOf.Root>
               </div>
               <FormDebug />
            </AppShell.Scrollable>
         </Form>
      </>
   );
}

const RootFormError = () => {
   const errors = useFormError("", { strict: true });
   if (errors.length === 0) return null;

   return (
      <Alert.Exception>
         {errors.map((error, i) => (
            <div key={i}>{error.message}</div>
         ))}
      </Alert.Exception>
   );
};

const Icons = {
   s3: IconBrandAws,
   cloudinary: IconCloud,
   local: IconServer,
   r2: IconBrandCloudflare,
};

const AdapterIcon = ({ type }: { type: string }) => {
   // find icon whose name starts with type
   const Icon = Object.entries(Icons).find(([key]) => type.startsWith(key))?.[1];
   if (!Icon) return null;
   return <Icon />;
};

function Adapters() {
   const ctx = AnyOf.useContext();

   return (
      <Formy.Group>
         <Formy.Label className="flex flex-row items-center gap-1">
            <span className="font-bold">Media Adapter:</span>
            {ctx.selected === null && <span className="opacity-70"> (Choose one)</span>}
         </Formy.Label>
         <div className="flex flex-row gap-1 mb-2">
            {ctx.schemas?.map((schema: any, i) => (
               <Button
                  key={i}
                  onClick={() => ctx.select(i)}
                  id={`adapter-${schema.properties.type.const}`}
                  variant={ctx.selected === i ? "primary" : "outline"}
                  className={twMerge(
                     "flex flex-row items-center justify-center gap-3 border",
                     ctx.selected === i && "border-primary",
                  )}
               >
                  <div>
                     <AdapterIcon type={schema.properties.type.const} />
                  </div>
                  <div className="flex flex-col items-start justify-center">
                     <span>{autoFormatString(schema.title)}</span>
                     {schema.description && (
                        <span className="text-xs opacity-70 text-left">{schema.description}</span>
                     )}
                  </div>
               </Button>
            ))}
         </div>
         {ctx.selected !== null && (
            <Formy.Group as="fieldset" error={ctx.errors.length > 0}>
               <Formy.Label as="legend" className="font-mono px-2">
                  {autoFormatString(ctx.selectedSchema!.title!)}
               </Formy.Label>
               <FormContextOverride schema={ctx.selectedSchema} prefix={ctx.path}>
                  <Field name="type" hidden />
                  <ObjectField path="config" wrapperProps={{ label: false, wrapper: "group" }} />
               </FormContextOverride>
            </Formy.Group>
         )}
      </Formy.Group>
   );
}

const Overlay = () => (
   <Subscribe selector={(state) => ({ enabled: state.data.enabled })}>
      {({ enabled }) =>
         !enabled && (
            <div className="absolute w-full h-full z-50 inset-0 bg-background opacity-90" />
         )
      }
   </Subscribe>
);
