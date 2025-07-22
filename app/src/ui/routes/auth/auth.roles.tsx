import {
   transformObject,
   ucFirstAllSnakeToPascalWithSpaces,
   s,
   stringIdentifier,
} from "bknd/utils";
import { useBkndAuth } from "ui/client/schema/auth/use-bknd-auth";
import { Alert } from "ui/components/display/Alert";
import { bkndModals } from "ui/modals";
import { Button } from "../../components/buttons/Button";
import { CellValue, DataTable } from "../../components/table/DataTable";
import * as AppShell from "../../layouts/AppShell/AppShell";
import { routes, useNavigate } from "../../lib/routes";

export function AuthRolesList() {
   const [navigate] = useNavigate();
   const { config, actions } = useBkndAuth();

   const data = Object.values(
      transformObject(config.roles ?? {}, (role, name) => ({
         role: name,
         permissions: role.permissions,
         is_default: role.is_default ?? false,
         implicit_allow: role.implicit_allow ?? false,
      })),
   );

   function handleClick(row) {
      navigate(routes.auth.roles.edit(row.role));
   }

   function openCreateModal() {
      bkndModals.open(
         "form",
         {
            schema: s.strictObject({
               name: stringIdentifier,
            }),
            uiSchema: {
               name: {
                  "ui:title": "Role name",
               },
            },
            onSubmit: async (data) => {
               if (data.name.length > 0) {
                  if (await actions.roles.add(data.name)) {
                     navigate(routes.auth.roles.edit(data.name));
                  }
               }
            },
         },
         {
            title: "New Role",
         },
      );
   }

   return (
      <>
         <AppShell.SectionHeader
            right={
               <Button variant="primary" onClick={openCreateModal}>
                  Create new
               </Button>
            }
         >
            Roles & Permissions
         </AppShell.SectionHeader>
         <AppShell.Scrollable>
            <Alert.Warning
               visible={!config.enabled}
               title="Auth not enabled"
               message="To use authentication features, please enable it in the settings."
            />
            <div className="flex flex-col flex-grow p-3 gap-3">
               <DataTable
                  data={data}
                  renderValue={renderValue}
                  renderHeader={ucFirstAllSnakeToPascalWithSpaces}
                  onClickRow={handleClick}
               />
            </div>
         </AppShell.Scrollable>
      </>
   );
}

const renderValue = ({ value, property }) => {
   if (["is_default", "implicit_allow"].includes(property)) {
      return value ? <span>Yes</span> : <span className="opacity-50">No</span>;
   }

   if (property === "permissions") {
      const max = 3;
      let permissions = value || [];
      const count = permissions.length;
      if (count > max) {
         permissions = [...permissions.slice(0, max), `+${count - max}`];
      }

      return (
         <div className="flex flex-row gap-1">
            {permissions.map((p, i) => (
               <span
                  key={i}
                  className="inline-block px-2 py-1.5 text-sm bg-primary/5 rounded font-mono leading-none"
               >
                  {p}
               </span>
            ))}
         </div>
      );
   }

   return <CellValue value={value} property={property} />;
};
