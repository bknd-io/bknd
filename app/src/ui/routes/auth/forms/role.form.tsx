import { Input, Switch, Tooltip } from "@mantine/core";
import { guardRoleSchema } from "auth/auth-schema";
import { ucFirst, type s } from "bknd/utils";
import { forwardRef, useImperativeHandle } from "react";
import { type UseControllerProps, useController, useForm } from "react-hook-form";
import { useBknd } from "ui/client/bknd";
import { Button } from "ui/components/buttons/Button";
import { MantineSwitch } from "ui/components/form/hook-form-mantine/MantineSwitch";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";

const schema = guardRoleSchema;
type Role = s.Static<typeof guardRoleSchema>;

export type AuthRoleFormRef = {
   getData: () => Role;
   isValid: () => boolean;
   reset: () => void;
};

export const AuthRoleForm = forwardRef<
   AuthRoleFormRef,
   {
      role?: Role;
      debug?: boolean;
   }
>(({ role, debug }, ref) => {
   const { permissions } = useBknd();

   const {
      formState: { isValid },
      watch,
      control,
      reset,
      getValues,
   } = useForm({
      resolver: standardSchemaResolver(schema),
      defaultValues: role,
   });

   useImperativeHandle(ref, () => ({
      reset,
      getData: () => getValues(),
      isValid: () => isValid,
   }));

   return (
      <div className="flex flex-col flex-grow px-5 py-5 gap-8">
         <div className="flex flex-col gap-2">
            {/*<h3 className="font-semibold">Role Permissions</h3>*/}
            <Permissions control={control} permissions={permissions} />
         </div>
         <div className="flex flex-col gap-4">
            <Input.Wrapper
               label="Should this role be the default?"
               size="md"
               description="In case an user is not assigned any role, this role will be assigned by default."
            >
               <div className="flex flex-row">
                  <MantineSwitch name="is_default" control={control} className="mt-2" />
               </div>
            </Input.Wrapper>
            <Input.Wrapper
               label="Implicit allow missing permissions?"
               size="md"
               description="This should be only used for admins. If a permission is not explicitly denied, it will be allowed."
            >
               <div className="flex flex-row">
                  <MantineSwitch name="implicit_allow" control={control} className="mt-2" />
               </div>
            </Input.Wrapper>
         </div>

         {debug && (
            <div className="font-mono opacity-50">
               <div>{JSON.stringify(role, null, 2)}</div>
               <div>{JSON.stringify(watch(), null, 2)}</div>
            </div>
         )}
      </div>
   );
});

const Permissions = ({
   control,
   permissions,
}: Omit<UseControllerProps, "name"> & { permissions: string[] }) => {
   const {
      field: { value, onChange: fieldOnChange, ...field },
      fieldState,
   } = useController<s.Static<typeof schema>, "permissions">({
      name: "permissions",
      control,
   });
   const data = value ?? [];

   function handleChange(permission: string) {
      return (e) => {
         const checked = e.target.checked;
         const newValue = checked ? [...data, permission] : data.filter((p) => p !== permission);
         fieldOnChange(newValue);
      };
   }

   const grouped = permissions.reduce(
      (acc, permission) => {
         const [group, name] = permission.split(".") as [string, string];
         if (!acc[group]) acc[group] = [];
         acc[group].push(permission);
         return acc;
      },
      {} as Record<string, string[]>,
   );

   console.log("grouped", grouped);
   //console.log("fieldState", fieldState, value);
   return (
      <div className="flex flex-col gap-10">
         {Object.entries(grouped).map(([group, permissions]) => {
            return (
               <div className="flex flex-col gap-2" key={group}>
                  <h3 className="font-semibold">{ucFirst(group)} Permissions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
                     {permissions.map((permission) => {
                        const selected = data.includes(permission);
                        return (
                           <div key={permission} className="flex flex-col border border-muted">
                              <div className="flex flex-row gap-2 justify-between">
                                 <div className="py-4 px-4 font-mono leading-none">
                                    {permission}
                                 </div>
                                 <div className="flex flex-row gap-1 items-center px-2">
                                    <Switch
                                       checked={selected}
                                       onChange={handleChange(permission)}
                                    />
                                    <Tooltip label="Coming soon">
                                       <Button size="small" variant="ghost" disabled>
                                          <span className="font-normal italic font-mono">FX</span>
                                       </Button>
                                    </Tooltip>
                                 </div>
                              </div>
                           </div>
                        );
                     })}
                  </div>
               </div>
            );
         })}
      </div>
   );
};
