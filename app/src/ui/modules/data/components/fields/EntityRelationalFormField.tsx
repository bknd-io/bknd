import { getHotkeyHandler, useHotkeys } from "@mantine/hooks";
import { ucFirst } from "core/utils";
import type { EntityData } from "bknd";
import type { RelationField } from "data/relations";
import { useEffect, useRef, useState } from "react";
import { TbEye } from "react-icons/tb";
import { useEntityQuery } from "ui/client";
import { useBknd } from "ui/client/bknd";
import { Button } from "ui/components/buttons/Button";
import * as Formy from "ui/components/form/Formy";
import { Popover } from "ui/components/overlay/Popover";
import { Link } from "ui/components/wouter/Link";
import { routes } from "ui/lib/routes";
import { useLocation } from "wouter";
import type { EntityTableProps } from "../EntityTable";
import type { ResponseObject } from "modules/ModuleApi";
import ErrorBoundary from "ui/components/display/ErrorBoundary";
import { EntityTable2 } from "ui/modules/data/components/EntityTable2";
import type { TFieldApi } from "ui/modules/data/components/EntityForm";

// @todo: allow clear if not required
export function EntityRelationalFormField({
   fieldApi,
   field,
   data,
   disabled,
   tabIndex,
}: {
   fieldApi: TFieldApi;
   field: RelationField;
   data?: EntityData;
   disabled?: boolean;
   tabIndex?: number;
}) {
   const { app } = useBknd();
   const entity = app.entity(field.target())!;
   const [query, setQuery] = useState<any>({
      limit: 10,
      page: 1,
      perPage: 10,
      select: entity.getSelect(undefined, "table"),
   });
   const [, navigate] = useLocation();
   const ref = useRef<any>(null);
   const $q = useEntityQuery(field.target(), undefined, {
      select: query.select,
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
   });
   const [_value, _setValue] = useState<{ id: number | undefined; [key: string]: any }>();

   const referenceField = data?.[field.reference()];
   const relationalField = data?.[field.name];

   useEffect(() => {
      const value = data?.[field.reference()];
      _setValue(value);
   }, [referenceField]);

   useEffect(() => {
      (async () => {
         const rel_value = field.target();
         if (!rel_value || !relationalField) return;

         const fetched = await $q.api.readOne(field.target(), relationalField);
         if (fetched.ok && fetched.data) {
            _setValue(fetched.data as any);
         }
      })();
   }, [relationalField]);

   function handleViewItem(e: React.MouseEvent<HTMLButtonElement>) {
      e.preventDefault();
      e.stopPropagation();
      if (_value) {
         navigate(routes.data.entity.edit(entity.name, _value.id as any));
      }
   }

   // fix missing value on fields that are required
   useEffect(() => {
      if (field.isRequired() && !fieldApi.state.value) {
         const firstValue = $q.data?.[0];
         if (!firstValue) return;

         console.warn("setting first value because field is required", field.name, firstValue.id);
         fieldApi.setValue(firstValue.id);
         _setValue(firstValue as any);
      }
   }, [$q.data]);

   const fetching = $q.isLoading || $q.isValidating;

   return (
      <Formy.Group>
         <Formy.Label htmlFor={fieldApi.name}>
            {field.getLabel({ fallback: false }) ?? entity.label}
         </Formy.Label>
         <div
            data-disabled={fetching || disabled ? 1 : undefined}
            className="data-[disabled]:opacity-70 data-[disabled]:pointer-events-none"
         >
            <Popover
               backdrop
               className=""
               target={({ toggle }) => (
                  <PopoverTable
                     container={$q.data}
                     entity={entity}
                     query={query}
                     toggle={toggle}
                     onClickRow={(row) => {
                        fieldApi.setValue(row.id);
                        _setValue(row as any);
                        toggle();
                     }}
                     onClickPage={(page) => {
                        console.log("setting page", page);
                        setQuery((prev) => ({ ...prev, page }));
                     }}
                  />
               )}
            >
               <div
                  ref={ref}
                  className="bg-muted/40 w-full h-11 focus:bg-muted rounded-md items-center px-2.5 outline-none focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent transition-all disabled:bg-muted/50 disabled:text-primary/50 cursor-pointer active:bg-muted/80 hover:bg-muted/60 flex flex-row gap-2"
                  tabIndex={tabIndex}
                  onKeyDown={getHotkeyHandler([
                     [
                        "Enter",
                        () => {
                           ref.current?.click();
                        },
                     ],
                  ])}
               >
                  {_value ? (
                     <>
                        <div className="flex bg-primary/10 px-2 leading-none py-1.5 rounded-lg font-mono text-sm">
                           {ucFirst(entity.name)}
                        </div>
                        <div className="flex flex-row gap-3 overflow-clip w-1 flex-grow">
                           {_value &&
                              Object.entries(_value).map(([key, value]) => {
                                 const field = entity.getField(key)!;
                                 if (field.isHidden("table")) return null;

                                 const _value = field.getValue(value, "table");
                                 return (
                                    <div
                                       key={key}
                                       className="flex flex-row gap-1 items-center flex-nowrap"
                                    >
                                       <span className="opacity-60 text-nowrap">
                                          {field.getLabel()}:
                                       </span>{" "}
                                       {_value !== null && typeof _value !== "undefined" ? (
                                          <ErrorBoundary
                                             fallback={JSON.stringify(_value)}
                                             suppressError
                                          >
                                             <span className="text-nowrap truncate">{_value}</span>
                                          </ErrorBoundary>
                                       ) : (
                                          <span className="opacity-30 text-nowrap font-mono mt-0.5">
                                             null
                                          </span>
                                       )}
                                    </div>
                                 );
                              })}
                        </div>
                        <Link to={routes.data.entity.edit(entity.name, _value.id as any)}>
                           <Button IconLeft={TbEye} size="small">
                              View
                           </Button>
                        </Link>
                     </>
                  ) : (
                     <div className="pl-2">- Select -</div>
                  )}
               </div>
            </Popover>
         </div>
         <Formy.Input
            type="hidden"
            name={fieldApi.name}
            id={fieldApi.name}
            value={fieldApi.state.value ?? ""}
            onChange={console.log}
            tabIndex={-1}
         />
      </Formy.Group>
   );
}

type PropoverTableProps = Omit<EntityTableProps, "data"> & {
   container: ResponseObject;
   query: any;
   toggle: () => void;
};
const PopoverTable = ({
   container,
   entity,
   query,
   toggle,
   onClickRow,
   onClickPage,
}: PropoverTableProps) => {
   function handleNext() {
      if (query.limit * query.page < container.meta?.count) {
         onClickPage?.(query.page + 1);
      }
   }

   function handlePrev() {
      if (query.page > 1) {
         onClickPage?.(query.page - 1);
      }
   }

   useHotkeys([
      ["ArrowRight", handleNext],
      ["ArrowLeft", handlePrev],
      ["Escape", toggle],
   ]);

   return (
      <div>
         <EntityTable2
            classNames={{ value: "line-clamp-1 truncate max-w-52 text-nowrap" }}
            data={container ?? []}
            entity={entity}
            select={query.select}
            total={container.meta?.count}
            page={query.page}
            onClickRow={onClickRow}
            onClickPage={onClickPage}
         />
      </div>
   );
};
