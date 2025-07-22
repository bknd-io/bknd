import type { Entity, EntityData } from "bknd";
import { CellValue, DataTable, type DataTableProps } from "ui/components/table/DataTable";
import ErrorBoundary from "ui/components/display/ErrorBoundary";

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
         return field.getLabel();
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
