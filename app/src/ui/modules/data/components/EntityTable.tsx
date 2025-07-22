import { useToggle } from "@mantine/hooks";
import type { Entity, EntityData } from "bknd";
import {
   TbArrowDown,
   TbArrowUp,
   TbChevronLeft,
   TbChevronRight,
   TbChevronsLeft,
   TbChevronsRight,
   TbSelector,
   TbSquare,
   TbSquareCheckFilled,
} from "react-icons/tb";
import { twMerge } from "tailwind-merge";
import { Button } from "ui/components/buttons/Button";
import { Dropdown } from "ui/components/overlay/Dropdown";

export const Check = () => {
   const [checked, toggle] = useToggle([false, true]);
   const Icon = checked ? TbSquareCheckFilled : TbSquare;
   return (
      <button role="checkbox" type="button" className="flex px-3 py-3" onClick={() => toggle()}>
         <Icon size={18} />
      </button>
   );
};

export type EntityTableProps = {
   data: EntityData[];
   entity: Entity;
   select?: string[];
   checkable?: boolean;
   onClickRow?: (row: EntityData) => void;
   onClickPage?: (page: number) => void;
   total?: number;
   page?: number;
   perPage?: number;
   perPageOptions?: number[];
   sort?: { by?: string; dir?: "asc" | "desc" };
   onClickSort?: (name: string) => void;
   onClickPerPage?: (perPage: number) => void;
   classNames?: {
      value?: string;
   };
};

export const EntityTable: React.FC<EntityTableProps> = ({
   data = [],
   entity,
   select,
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
}) => {
   select = select && select.length > 0 ? select : entity.getSelect();
   total = total || data.length;
   page = page || 1;

   const pages = Math.max(Math.ceil(total / perPage), 1);
   const fields = entity.getFields();

   function getField(name: string) {
      return fields.find((field) => field.name === name);
   }

   function handleSortClick(name: string) {}

   return (
      <div className="flex flex-col gap-3">
         <div className="border-muted border rounded-md shadow-sm w-full max-w-full overflow-y-scroll">
            <table className="w-full">
               <thead className="sticky top-0 bg-background">
                  <tr>
                     {checkable && (
                        <th align="center" className="w-[40px]">
                           <Check />
                        </th>
                     )}
                     {select.map((property, key) => {
                        const field = getField(property)!;

                        return (
                           <th key={key}>
                              <div className="flex flex-row py-1 px-1 font-normal text-primary/55">
                                 <button
                                    type="button"
                                    className="link hover:bg-primary/5 pl-2.5 pr-1 py-1.5 rounded-md inline-flex flex-row justify-start items-center gap-1"
                                    onClick={() => onClickSort?.(field.name)}
                                 >
                                    <span className="text-left text-nowrap whitespace-nowrap">
                                       {field.getLabel()}
                                    </span>
                                    <SortIndicator sort={sort} field={field.name} />
                                 </button>
                              </div>
                           </th>
                        );
                     })}
                  </tr>
               </thead>
               <tbody>
                  {data.map((row, key) => {
                     return (
                        <tr
                           key={key}
                           data-border={key > 0}
                           className="hover:bg-primary/5 active:bg-muted border-muted data-[border]:border-t cursor-pointer transition-colors"
                           onClick={() => onClickRow?.(row)}
                        >
                           {checkable && (
                              <td align="center">
                                 <Check />
                              </td>
                           )}

                           {Object.entries(row).map(([key, value], index) => {
                              const field = getField(key);
                              const _value = field?.getValue(value, "table");
                              return (
                                 <td key={index}>
                                    <div className="flex flex-row items-start py-3 px-3.5 font-normal ">
                                       {value !== null && typeof value !== "undefined" ? (
                                          <span
                                             className={twMerge(classNames?.value, "line-clamp-2")}
                                          >
                                             {_value}
                                          </span>
                                       ) : (
                                          <span className="opacity-10 font-mono">null</span>
                                       )}
                                    </div>
                                 </td>
                              );
                           })}
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </div>
         <div className="flex flex-row items-center justify-between">
            <div className="hidden md:flex text-primary/40">
               <TableDisplay perPage={perPage} page={page} items={data.length} total={total} />
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
};

const SortIndicator = ({
   sort,
   field,
}: {
   sort: Pick<EntityTableProps, "sort">["sort"];
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
