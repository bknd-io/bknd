import type { Entity, EntityData } from "bknd";
import { CellValue, DataTable, type DataTableProps } from "ui/components/table/DataTable";
import ErrorBoundary from "ui/components/display/ErrorBoundary";
import { TbSettings } from "react-icons/tb";

type EntityTableProps<Data extends EntityData = EntityData> = Omit<
   DataTableProps<Data>,
   "columns"
> & {
   entity: Entity;
   select?: string[];
};

export function EntityTable2({ entity, select, ...props }: EntityTableProps) {
   const columns = select ?? entity.getSelect();

   const fields = entity.getFields();

   function getField(name: string) {
      return fields.find((field) => field.name === name);
   }

   function renderHeader(column: string) {
      try {
         const field = getField(column)!;
         const label = field.getLabel();
         
         // Show custom handler indicator for primary fields with custom handlers
         if (field.type === "primary" && field.isCustomFormat && field.isCustomFormat()) {
            return (
               <div className="flex items-center gap-1">
                  {label}
                  <TbSettings className="w-3 h-3 text-purple-600" title="Custom ID Handler" />
               </div>
            );
         }
         
         return label;
      } catch (e) {
         console.warn("Couldn't render header", { entity, select, ...props }, e);
         return column;
      }
   }

   function renderValue({ value, property }) {
      let _value: any = value;
      try {
         const field = getField(property)!;
         _value = field.getValue(value, "table");
      } catch (e) {
         console.warn(
            "Couldn't render value",
            { value, property, entity, select, columns, ...props },
            e,
         );
      }

      return (
         <ErrorBoundary fallback={String(_value)}>
            <CellValue value={_value} property={property} />
         </ErrorBoundary>
      );
   }

   return (
      <DataTable
         {...props}
         columns={columns}
         renderHeader={renderHeader}
         renderValue={renderValue}
      />
   );
}
