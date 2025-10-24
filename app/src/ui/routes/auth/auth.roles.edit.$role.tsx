import { useBknd } from "ui/client/bknd";
import { Message } from "ui/components/display/Message";
import { useBkndAuth } from "ui/client/schema/auth/use-bknd-auth";
import { useBrowserTitle } from "ui/hooks/use-browser-title";
import { useState } from "react";
import { useNavigate } from "ui/lib/routes";
import { isDebug } from "core/env";
import { Dropdown } from "ui/components/overlay/Dropdown";
import { IconButton } from "ui/components/buttons/IconButton";
import { TbAdjustments, TbDots, TbFilter, TbTrash, TbInfoCircle, TbCodeDots } from "react-icons/tb";
import { Button } from "ui/components/buttons/Button";
import { Breadcrumbs2 } from "ui/layouts/AppShell/Breadcrumbs2";
import { routes } from "ui/lib/routes";
import * as AppShell from "ui/layouts/AppShell/AppShell";
import * as Formy from "ui/components/form/Formy";
import { ucFirst, s, transformObject, isObject } from "bknd/utils";
import type { ModuleSchemas } from "bknd";
import {
   CustomField,
   Field,
   FieldWrapper,
   Form,
   FormContextOverride,
   FormDebug,
   ObjectJsonField,
   Subscribe,
   useDerivedFieldContext,
   useFormContext,
   useFormError,
   useFormValue,
} from "ui/components/form/json-schema-form";
import type { TPermission } from "auth/authorize/Permission";
import type { RoleSchema } from "auth/authorize/Role";
import { SegmentedControl, Tooltip } from "@mantine/core";
import { Popover } from "ui/components/overlay/Popover";
import { cn } from "ui/lib/utils";
import { JsonViewer } from "ui/components/code/JsonViewer";
import { mountOnce, useApiQuery } from "ui/client";
import { CodePreview } from "ui/components/code/CodePreview";

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

function AuthRolesEditInternal({ params }: { params: { role: string } }) {
   const [navigate] = useNavigate();
   const { config, schema: authSchema, actions } = useBkndAuth();
   const roleName = params.role;
   const role = config.roles?.[roleName];
   const { readonly, permissions } = useBknd();
   const schema = getSchema(authSchema);
   const data = {
      ...role,
      // this is to maintain array structure
      permissions: permissions.map((p) => {
         return role?.permissions?.find((v: any) => v.permission === p.name);
      }),
   };

   async function handleDelete() {
      const success = await actions.roles.delete(roleName);
      if (success) {
         navigate(routes.auth.roles.list());
      }
   }
   async function handleUpdate(data: any) {
      await actions.roles.patch(roleName, data);
   }

   return (
      <Form
         schema={schema as any}
         initialValues={data}
         {...formConfig}
         beforeSubmit={(data) => {
            return {
               ...data,
               permissions: [...Object.values(data.permissions)],
            };
         }}
         onSubmit={handleUpdate}
      >
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
   const { value } = useDerivedFieldContext("permissions", (ctx) => {
      const v = ctx.value;
      if (!Array.isArray(v)) return undefined;
      return v.find((v) => v && v.permission === permission.name);
   });
   const { setValue } = useFormContext();
   const [open, setOpen] = useState(false);
   const data = value as PermissionData | undefined;
   const policiesCount = data?.policies?.length ?? 0;

   async function handleSwitch() {
      if (data) {
         setValue(path, undefined);
         setOpen(false);
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
               <div className="py-4 px-4 font-mono leading-none flex flex-row gap-2 items-center">
                  {permission.name}
                  {permission.filterable && (
                     <Tooltip label="Permission supports filtering">
                        <TbFilter className="opacity-50" />
                     </Tooltip>
                  )}
               </div>
               <div className="flex flex-grow" />
               <div className="flex flex-row gap-1 items-center px-2">
                  <div className="relative flex flex-row gap-1 items-center">
                     {policiesCount > 0 && (
                        <div className="bg-primary/80 text-background rounded-full size-5 flex items-center justify-center text-sm font-bold pointer-events-none">
                           {policiesCount}
                        </div>
                     )}
                     <IconButton
                        size="md"
                        variant="ghost"
                        disabled={!data}
                        Icon={TbAdjustments}
                        className={cn("disabled:opacity-20")}
                        onClick={() => setOpen((o) => !o)}
                     />
                  </div>
                  <Formy.Switch size="sm" checked={!!data} onChange={handleSwitch} />
               </div>
            </div>
            {open && (
               <div className="px-3.5 py-3.5">
                  <Policies path={`permissions.${index}.policies`} permission={permission} />
               </div>
            )}
         </div>
      </>
   );
};

const Policies = ({ path, permission }: { path: string; permission: TPermission }) => {
   const { value: _value } = useFormValue(path);
   const { setValue, schema: policySchema, lib, deleteValue } = useDerivedFieldContext(path);
   const value = _value ?? [];

   function handleAdd() {
      setValue(
         `${path}.${value.length}`,
         lib.getTemplate(undefined, policySchema!.items, {
            addOptionalProps: true,
         }),
      );
   }

   function handleDelete(index: number) {
      deleteValue(`${path}.${index}`);
   }

   return (
      <div className={cn("flex flex-col", value.length > 0 && "gap-8")}>
         <div className="flex flex-col gap-5">
            {value.map((policy, i) => (
               <FormContextOverride key={i} prefix={`${path}.${i}`} schema={policySchema.items!}>
                  {i > 0 && <div className="h-px bg-muted" />}
                  <div className="flex flex-row gap-2 items-start">
                     <div className="flex flex-col flex-grow w-full">
                        <Policy permission={permission} />
                     </div>
                     <IconButton Icon={TbTrash} onClick={() => handleDelete(i)} size="sm" />
                  </div>
               </FormContextOverride>
            ))}
         </div>
         <div className="flex flex-row justify-center">
            <Button onClick={handleAdd}>Add Policy</Button>
         </div>
      </div>
   );
};

const mergeSchemas = (...schemas: object[]) => {
   const schema = s.allOf(schemas.filter(Boolean).map(s.fromSchema));
   return s.toTypes(schema, "Context");
};

function replaceEntitiesEnum(schema: Record<string, any>, entities: string[]) {
   if (!isObject(schema) || !Array.isArray(entities) || entities.length === 0) return schema;
   return transformObject(schema, (sub, name) => {
      if (name === "properties") {
         return transformObject(sub as Record<string, any>, (propConfig, propKey) => {
            if (propKey === "entity" && propConfig.type === "string") {
               return {
                  ...propConfig,
                  enum: entities,
               };
            }
            return propConfig;
         });
      }
      return sub;
   });
}

const Policy = ({
   permission,
}: {
   permission: TPermission;
}) => {
   const { value } = useFormValue("");
   const $bknd = useBknd();
   const $permissions = useApiQuery((api) => api.system.permissions(), {
      use: [mountOnce],
   });
   const entities = Object.keys($bknd.config.data.entities ?? {});
   const ctx = $permissions.data
      ? mergeSchemas(
           $permissions.data.context,
           replaceEntitiesEnum(permission.context ?? null, entities),
        )
      : undefined;

   return (
      <div className="flex flex-col gap-2">
         <Field name="description" />

         <CustomFieldWrapper
            name="condition"
            label="Condition"
            description="The condition that must be met for the policy to be applied."
            schema={ctx}
         >
            <ObjectJsonField path="condition" />
         </CustomFieldWrapper>

         <CustomField path="effect">
            {({ value, setValue }) => (
               <FieldWrapper
                  name="effect"
                  label="Effect"
                  descriptionPlacement="label"
                  description="The effect of the policy to take effect on met condition."
               >
                  <SegmentedControl
                     className="border border-muted"
                     defaultValue={value}
                     onChange={(value) => setValue(value)}
                     data={
                        ["allow", "deny", permission.filterable ? "filter" : undefined]
                           .filter(Boolean)
                           .map((effect) => ({
                              label: ucFirst(effect ?? ""),
                              value: effect,
                           })) as any
                     }
                  />
               </FieldWrapper>
            )}
         </CustomField>

         {value?.effect === "filter" && (
            <CustomFieldWrapper
               name="filter"
               label="Filter"
               description="Filter to apply to all queries on met condition."
               schema={ctx}
            >
               <ObjectJsonField path="filter" />
            </CustomFieldWrapper>
         )}
      </div>
   );
};

const CustomFieldWrapper = ({ children, name, label, description, schema }: any) => {
   const errors = useFormError(name, { strict: true });
   const Errors = errors.length > 0 && (
      <Formy.ErrorMessage>{errors.map((e) => e.message).join(", ")}</Formy.ErrorMessage>
   );

   return (
      <Formy.Group as="div">
         <Formy.Label
            as="label"
            htmlFor={name}
            className="flex flex-row gap-1 justify-between items-center"
         >
            <div className="flex flex-row gap-1 items-center">
               {label}
               {description && (
                  <Tooltip label={description}>
                     <TbInfoCircle className="size-4 opacity-50" />
                  </Tooltip>
               )}
            </div>
            {schema && (
               <div>
                  <Popover
                     overlayProps={{
                        className: "max-w-none",
                     }}
                     position="bottom-end"
                     target={() =>
                        typeof schema === "object" ? (
                           <JsonViewer
                              className="w-auto max-w-120 bg-background pr-3 text-sm"
                              json={schema}
                              expand={5}
                           />
                        ) : (
                           <CodePreview
                              code={schema}
                              lang="typescript"
                              className="w-auto max-w-120 bg-background p-3 text-sm"
                           />
                        )
                     }
                  >
                     <Button variant="ghost" size="smaller" IconLeft={TbCodeDots}>
                        Context
                     </Button>
                  </Popover>
               </div>
            )}
         </Formy.Label>
         {children}
         {Errors}
      </Formy.Group>
   );
};
