import { IconRefresh, IconSettings } from "@tabler/icons-react";
import { ucFirst } from "core/utils";
import { useBknd } from "ui/client/bknd";
import { Empty } from "ui/components/display/Empty";
import { Message } from "ui/components/display/Message";
import { Link } from "ui/components/wouter/Link";
import { useBrowserTitle } from "ui/hooks/use-browser-title";
import * as AppShell from "ui/layouts/AppShell/AppShell";
import { Route, Switch } from "wouter";
import { Setting, type SettingProps } from "./components/Setting";
import { AuthSettings } from "./routes/auth.settings";
import { DataSettings } from "./routes/data.settings";
import { FlowsSettings } from "./routes/flows.settings";
import { ServerSettings } from "./routes/server.settings";
import { IconButton } from "ui/components/buttons/IconButton";
import { SettingsHistory } from "ui/routes/settings/routes/history";

function SettingsSidebar() {
   const { version, schema, actions, app } = useBknd();
   useBrowserTitle(["Settings"]);

   async function handleRefresh() {
      await actions.reload();
   }

   const modules = Object.keys(schema).map((key) => {
      return {
         title: schema[key].title ?? ucFirst(key),
         key,
      };
   });

   return (
      <AppShell.Sidebar>
         <AppShell.SectionHeader
            right={
               <div className="flex items-center gap-2">
                  <span className="font-mono leading-none">v{version}</span>
                  <IconButton Icon={IconRefresh} onClick={handleRefresh} />
               </div>
            }
         >
            Settings
         </AppShell.SectionHeader>
         <AppShell.Scrollable initialOffset={96}>
            <div className="flex flex-col flex-grow p-3 gap-3">
               <nav className="flex flex-col flex-1 gap-1">
                  {modules.map((module, key) => (
                     <AppShell.SidebarLink as={Link} key={key} href={`/${module.key}`}>
                        {module.title}
                     </AppShell.SidebarLink>
                  ))}
               </nav>
            </div>
         </AppShell.Scrollable>
      </AppShell.Sidebar>
   );
}

export default function SettingsRoutes() {
   const b = useBknd({ withSecrets: true });
   if (!b.hasSecrets) return <Message.MissingPermission what="the settings" />;

   return (
      <>
         <SettingsSidebar />
         <AppShell.Main>
            <Switch>
               <Route
                  path="/"
                  component={() => (
                     <Empty
                        Icon={IconSettings}
                        title="No Setting selected"
                        description="Please select a setting from the left sidebar."
                     />
                  )}
               />
               <Route path="/history" nest component={SettingsHistory} />

               <SettingRoutesRoutes />

               <Route
                  path="*"
                  component={() => (
                     <Empty
                        Icon={IconSettings}
                        title="Settings not found"
                        description="Check other options."
                     />
                  )}
               />
            </Switch>
         </AppShell.Main>
      </>
   );
}

const uiSchema = {
   server: {
      cors: {
         allow_methods: {
            "ui:widget": "checkboxes",
         },
         allow_headers: {
            "ui:options": {
               orderable: false,
            },
         },
      },
   },
   media: {
      adapter: {
         "ui:options": {
            label: false,
         },
         /*type: {
            "ui:widget": "hidden"
         }*/
      },
   },
};

const SettingRoutesRoutes = () => {
   const { schema, config } = useBknd();

   console.log("flows", {
      schema: schema.flows,
      config: config.flows,
   });

   return (
      <>
         <ServerSettings schema={schema.server} config={config.server} />
         <DataSettings schema={schema.data} config={config.data} />
         <AuthSettings schema={schema.auth} config={config.auth} />
         <FallbackRoutes
            module="media"
            schema={schema}
            config={config}
            uiSchema={uiSchema.media}
            options={{ reloadOnSave: true }}
         />
         <FlowsSettings schema={schema.flows} config={config.flows} />
      </>
   );
};

const FallbackRoutes = ({
   module,
   schema,
   config,
   ...settingProps
}: SettingProps<any> & { module: string }) => {
   const { app } = useBknd();
   const prefix = app.getAbsolutePath("settings");

   return (
      <Route path={module} nest>
         <Switch>
            <Route
               path="/"
               component={() => (
                  <Setting
                     {...settingProps}
                     schema={schema[module]}
                     config={config[module]}
                     prefix={`${prefix}/${module}`}
                     path={[module]}
                  />
               )}
               nest
            />
         </Switch>
      </Route>
   );
};
