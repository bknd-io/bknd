import { Menu } from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { ucFirst } from "core/utils";
import {
   TbArrowDown,
   TbArrowUp,
   TbChevronLeft,
   TbChevronRight,
   TbChevronsLeft,
   TbChevronsRight,
   TbDotsVertical,
   TbSelector,
   TbSquare,
   TbSquareCheckFilled,
} from "react-icons/tb";
import { twMerge } from "tailwind-merge";
import { Button } from "ui/components/buttons/Button";
import { IconButton } from "../buttons/IconButton";
import { Dropdown, type DropdownItem } from "../overlay/Dropdown";

export const Check = () => {
   const [checked, toggle] = useToggle([false, true]);
   const Icon = checked ? TbSquareCheckFilled : TbSquare;
   return (
      <button role="checkbox" type="button" className="flex px-3 py-3" onClick={() => toggle()}>
         <Icon size={18} />
      </button>
   );
};

export type DataTableProps<Data> = {
   data: Data[] | null; // "null" implies loading
   columns?: string[];
   checkable?: boolean;
   onClickRow?: (row: Data) => void;
   onClickPage?: (page: number) => void;
   total?: number;
   page?: number;
   perPage?: number;
   rowActions?: (Omit<DropdownItem, "onClick"> & {
      onClick: (row: Data, key: number) => void;
   })[];
   perPageOptions?: number[];
   sort?: { by?: string; dir?: "asc" | "desc" };
   onClickSort?: (name: string) => void;
   onClickPerPage?: (perPage: number) => void;
   renderHeader?: (column: string) => React.ReactNode;
   renderValue?: ({ value, property }: { value: any; property: string }) => React.ReactNode;
   classNames?: {
      value?: string;
   };
   onClickNew?: () => void;
};

export function DataTable<Data extends Record<string, any> = Record<string, any>>({
   data = [],
   columns,
   checkable,
   onClickRow,
   onClickPage,
   onClickSort,
   total,
   sort,
   page = 1,
   perPage = 10,
   perPageOptions,
   onClickPerPage,
   classNames,
   renderHeader,
   rowActions,
   renderValue,
   onClickNew,
}: DataTableProps<Data>) {
   total = total || data?.length || 0;
   page = page || 1;

   const select = columns && columns.length > 0 ? columns : Object.keys(data?.[0] || {});
   const pages = Math.max(Math.ceil(total / perPage), 1);
   const CellRender = renderValue || CellValue;

   return (
      <div className="flex flex-col gap-3">
         {onClickNew && (
            <div className="flex flex-row space-between">
               {onClickNew && <Button onClick={onClickNew}>Create new</Button>}
            </div>
         )}
         <div className="border-muted border rounded-md shadow-sm w-full max-w-full overflow-x-scroll overflow-y-hidden">
            <table className="w-full text-md">
               {select.length > 0 ? (
                  <thead className="sticky top-0 bg-muted/10">
                     <tr>
                        {checkable && (
                           <th align="center" className="w-[40px]">
                              <Check />
                           </th>
                        )}
                        {select.map((property, key) => {
                           const label = renderHeader?.(property) ?? ucFirst(property);

                           return (
                              <th key={key}>
                                 <div className="flex flex-row py-1 px-1 font-normal text-primary/55">
                                    <button
                                       type="button"
                                       className={twMerge(
                                          "py-1.5 rounded-md inline-flex flex-row justify-start items-center gap-1",
                                          onClickSort
                                             ? "link hover:bg-primary/5 pl-2.5 pr-1"
                                             : "px-2.5",
                                       )}
                                       onClick={() => onClickSort?.(property)}
                                    >
                                       <span className="text-left text-nowrap whitespace-nowrap">
                                          {label}
                                       </span>
                                       {(onClickSort || (sort && sort.by === property)) && (
                                          <SortIndicator sort={sort} field={property} />
                                       )}
                                    </button>
                                 </div>
                              </th>
                           );
                        })}
                        {rowActions && rowActions.length > 0 && <th className="w-10" />}
                     </tr>
                  </thead>
               ) : null}
               <tbody>
                  {!data || !Array.isArray(data) || data.length === 0 ? (
                     <tr>
                        <td colSpan={select.length + (checkable ? 1 : 0)}>
                           <div className="flex flex-col gap-2 p-8 justify-center items-center border-t border-muted">
                              <i className="opacity-50">
                                 {Array.isArray(data) ? (
                                    "No data to show"
                                 ) : !data ? (
                                    "Loading..."
                                 ) : (
                                    <pre>{JSON.stringify(data, null, 2)}</pre>
                                 )}
                              </i>
                           </div>
                        </td>
                     </tr>
                  ) : (
                     data.map((row, key) => {
                        const rowClick = () => onClickRow?.(row);
                        return (
                           <tr
                              key={key}
                              data-border={key > 0}
                              className="hover:bg-primary/5 active:bg-muted border-muted data-[border]:border-t cursor-pointer transition-colors"
                           >
                              {checkable && (
                                 <td align="center">
                                    <Check />
                                 </td>
                              )}

                              {Object.entries(row).map(([key, value], index) => (
                                 <td key={index} onClick={rowClick}>
                                    <div className="flex flex-row items-start py-3 px-3.5 font-normal ">
                                       <CellRender property={key} value={value} />
                                    </div>
                                 </td>
                              ))}

                              {rowActions && rowActions.length > 0 && (
                                 <td>
                                    {/* @todo: create new dropdown using popover */}
                                    <div className="flex flex-row justify-end pr-2">
                                       <Menu position="bottom-end">
                                          <Menu.Target>
                                             <IconButton Icon={TbDotsVertical} />
                                          </Menu.Target>
                                          <Menu.Dropdown>
                                             {rowActions.map((a: any) => (
                                                <Menu.Item
                                                   key={a.label}
                                                   onClick={() => a.onClick(row, key)}
                                                   leftSection={a.icon && <a.icon />}
                                                >
                                                   {a.label}
                                                </Menu.Item>
                                             ))}
                                          </Menu.Dropdown>
                                       </Menu>
                                    </div>
                                 </td>
                              )}
                           </tr>
                        );
                     })
                  )}
               </tbody>
            </table>
         </div>
         <div className="flex flex-row items-center justify-between">
            <div className="hidden md:flex text-primary/40">
               <TableDisplay
                  perPage={perPage}
                  page={page}
                  items={data?.length || 0}
                  total={total}
               />
            </div>
            <div className="flex flex-row gap-2 md:gap-10 items-center">
               {perPageOptions && (
                  <div className="hidden md:flex flex-row items-center gap-2 text-primary/40">
                     Per Page{" "}
                     <Dropdown
                        items={perPageOptions.map((perPage) => ({
                           label: String(perPage),
                           perPage,
                        }))}
                        position="top-end"
                        onClickItem={(item: any) => onClickPerPage?.(item.perPage)}
                     >
                        <Button>{perPage}</Button>
                     </Dropdown>
                  </div>
               )}
               <div className="text-primary/40">
                  Page {page} of {pages}
               </div>
               {onClickPage && (
                  <div className="flex flex-row gap-1.5">
                     <TableNav current={page} total={pages} onClick={onClickPage} />
                  </div>
               )}
            </div>
         </div>
      </div>
   );
}

export const CellValue = ({ value, property }) => {
   let value_mono = false;
   //console.log("value", property, value);
   if (value !== null && typeof value === "object") {
      value = JSON.stringify(value);
      value_mono = true;
   }

   if (value !== null && typeof value !== "undefined") {
      return (
         <span className={twMerge("line-clamp-2", value_mono && "font-mono break-all")}>
            {value}
         </span>
      );
   }

   return <span className="opacity-10 font-mono">null</span>;
};

const SortIndicator = ({
   sort,
   field,
}: {
   sort: Pick<DataTableProps<any>, "sort">["sort"];
   field: string;
}) => {
   if (!sort || sort.by !== field) return <TbSelector size={18} className="mt-[1px]" />;

   if (sort.dir === "asc") return <TbArrowUp size={18} className="mt-[1px]" />;
   return <TbArrowDown size={18} className="mt-[1px]" />;
};

const TableDisplay = ({ perPage, page, items, total }) => {
   if (total === 0) {
      return <>No rows to show</>;
   }

   if (total === 1) {
      return <>Showing 1 row</>;
   }

   return (
      <>
         Showing {perPage * (page - 1) + 1}-{perPage * (page - 1) + items} of {total} rows
      </>
   );
};

type TableNavProps = {
   current: number;
   total: number;
   onClick?: (page: number) => void;
};

const TableNav: React.FC<TableNavProps> = ({ current, total, onClick }: TableNavProps) => {
   const navMap = [
      { value: 1, Icon: TbChevronsLeft, disabled: current === 1 },
      { value: current - 1, Icon: TbChevronLeft, disabled: current === 1 },
      { value: current + 1, Icon: TbChevronRight, disabled: current === total },
      { value: total, Icon: TbChevronsRight, disabled: current === total },
   ] as const;

   return navMap.map((nav, key) => (
      <button
         role="button"
         type="button"
         key={key}
         disabled={nav.disabled}
         className="px-2 py-2 border-muted border rounded-md enabled:link text-lg enabled:hover:bg-primary/5 text-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
         onClick={() => {
            const page = nav.value;
            const safePage = page < 1 ? 1 : page > total ? total : page;
            onClick?.(safePage);
         }}
      >
         <nav.Icon />
      </button>
   ));
};
