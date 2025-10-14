import { useBknd } from "ui/client/bknd";
import { Message } from "ui/components/display/Message";
import { useBkndAuth } from "ui/client/schema/auth/use-bknd-auth";
import { useBrowserTitle } from "ui/hooks/use-browser-title";
import { useRef, useState } from "react";
import { useNavigate } from "ui/lib/routes";
import { isDebug } from "core/env";
import { Dropdown } from "ui/components/overlay/Dropdown";
import { IconButton } from "ui/components/buttons/IconButton";
import { TbAdjustments, TbDots, TbLock, TbLockOpen, TbLockOpen2 } from "react-icons/tb";
import { Button } from "ui/components/buttons/Button";
import { Breadcrumbs2 } from "ui/layouts/AppShell/Breadcrumbs2";
import { routes } from "ui/lib/routes";
import * as AppShell from "ui/layouts/AppShell/AppShell";
import * as Formy from "ui/components/form/Formy";

import { ucFirst, type s } from "bknd/utils";
import type { ModuleSchemas } from "bknd";
import {
   ArrayField,
   Field,
   Form,
   FormDebug,
   Subscribe,
   useFormContext,
   useFormValue,
} from "ui/components/form/json-schema-form";
import type { TPermission } from "auth/authorize/Permission";
import type { RoleSchema } from "auth/authorize/Role";
import { SegmentedControl, Tooltip } from "@mantine/core";
import { cn } from "ui/lib/utils";

export function AuthRolesEdit(props) {
   useBrowserTitle(["Auth", "Roles", props.params.role]);

   const { hasSecrets } = useBknd({ withSecrets: true });
   if (!hasSecrets) {
      return <Message.MissingPermission what="Roles & Permissions" />;
   }

   return <AuthRolesEditInternal {...props} />;
}

// currently for backward compatibility
function getSchema(authSchema: ModuleSchemas["auth"]) {
   const roles = authSchema.properties.roles.additionalProperties;
   return {
      ...roles,
      properties: {
         ...roles.properties,
         permissions: {
            ...roles.properties.permissions.anyOf[1],
         },
      },
   };
}

const formConfig = {
   options: {
      debug: isDebug(),
   },
};

function AuthRolesEditInternal({ params }) {
   const [navigate] = useNavigate();
   const { config, schema: authSchema, actions } = useBkndAuth();
   const roleName = params.role;
   const role = config.roles?.[roleName];
   const { readonly } = useBknd();
   const schema = getSchema(authSchema);

   async function handleDelete() {}
   async function handleUpdate(data: any) {
      console.log("data", data);
      const success = await actions.roles.patch(roleName, data);
      console.log("success", success);
      /* if (success) {
         navigate(routes.auth.roles.list());
      } */
   }

   return (
      <Form schema={schema as any} initialValues={role} {...formConfig} onSubmit={handleUpdate}>
         <AppShell.SectionHeader
            right={
               <>
                  <Dropdown
                     items={[
                        {
                           label: "Advanced Settings",
                           onClick: () =>
                              navigate(routes.settings.path(["auth", "roles", roleName]), {
                                 absolute: true,
                              }),
                        },
                        !readonly && {
                           label: "Delete",
                           onClick: handleDelete,
                           destructive: true,
                        },
                     ]}
                     position="bottom-end"
                  >
                     <IconButton Icon={TbDots} />
                  </Dropdown>
                  {!readonly && (
                     <Subscribe
                        selector={(state) => ({
                           dirty: state.dirty,
                           errors: state.errors.length > 0,
                           submitting: state.submitting,
                        })}
                     >
                        {({ dirty, errors, submitting }) => (
                           <Button
                              variant="primary"
                              type="submit"
                              disabled={!dirty || errors || submitting}
                           >
                              Update
                           </Button>
                        )}
                     </Subscribe>
                  )}
               </>
            }
            className="pl-3"
         >
            <Breadcrumbs2
               path={[
                  { label: "Roles & Permissions", href: routes.auth.roles.list() },
                  { label: roleName },
               ]}
            />
         </AppShell.SectionHeader>
         <AppShell.Scrollable>
            <div className="flex flex-col flex-grow px-5 py-5 gap-8">
               <div className="flex flex-col gap-2">
                  <Permissions />
               </div>

               <div className="flex flex-col gap-4">
                  <Field
                     label="Should this role be the default?"
                     name="is_default"
                     description="In case an user is not assigned any role, this role will be assigned by default."
                     descriptionPlacement="top"
                  />
                  <Field
                     label="Implicit allow missing permissions?"
                     name="implicit_allow"
                     description="This should be only used for admins. If a permission is not explicitly denied, it will be allowed."
                     descriptionPlacement="top"
                  />
               </div>
            </div>
            <FormDebug />
         </AppShell.Scrollable>
      </Form>
   );
}

type PermissionsData = Exclude<RoleSchema["permissions"], string[] | undefined>;
type PermissionData = PermissionsData[number];

const Permissions = () => {
   const { permissions } = useBknd();

   const grouped = permissions.reduce(
      (acc, permission, index) => {
         const [group, name] = permission.name.split(".") as [string, string];
         if (!acc[group]) acc[group] = [];
         acc[group].push({ index, permission });
         return acc;
      },
      {} as Record<string, { index: number; permission: TPermission }[]>,
   );

   return (
      <div className="flex flex-col gap-10">
         {Object.entries(grouped).map(([group, rows]) => {
            return (
               <div className="flex flex-col gap-2" key={group}>
                  <h3 className="font-semibold">{ucFirst(group)} Permissions</h3>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
                     {rows.map(({ index, permission }) => (
                        <Permission key={permission.name} permission={permission} index={index} />
                     ))}
                  </div>
               </div>
            );
         })}
      </div>
   );
};

const Permission = ({ permission, index }: { permission: TPermission; index?: number }) => {
   const path = `permissions.${index}`;
   const { value } = useFormValue(path);
   const { setValue, deleteValue } = useFormContext();
   const [open, setOpen] = useState(false);
   const data = value as PermissionData | undefined;

   async function handleSwitch() {
      if (data) {
         deleteValue(path);
      } else {
         setValue(path, {
            permission: permission.name,
            policies: [],
            effect: "allow",
         });
      }
   }

   return (
      <>
         <div
            key={permission.name}
            className={cn("flex flex-col border border-muted", open && "border-primary/20")}
         >
            <div className={cn("flex flex-row gap-2 justify-between", open && "bg-primary/5")}>
               <div className="py-4 px-4 font-mono leading-none">{permission.name}</div>
               <div className="flex flex-row gap-1 items-center px-2">
                  <Formy.Switch size="sm" checked={!!data} onChange={handleSwitch} />
                  <Tooltip label="Customize" disabled>
                     <IconButton
                        size="md"
                        variant="ghost"
                        disabled={!data}
                        Icon={TbAdjustments}
                        className="disabled:opacity-20"
                        onClick={() => setOpen((o) => !o)}
                     />
                  </Tooltip>
               </div>
            </div>
            {open && (
               <div className="px-3.5 py-3.5">
                  <ArrayField
                     path={`permissions.${index}.policies`}
                     labelAdd="Add Policy"
                     wrapperProps={{
                        label: false,
                        wrapper: "group",
                     }}
                  />
               </div>
            )}
         </div>
      </>
   );
};
