import { AppShell } from "ui/layouts/AppShell";
import { Route, Switch, useParams } from "wouter";
import { useEffect, useState } from "react";
import { CellValue, DataTable } from "ui/components/table/DataTable";
import { twMerge } from "tailwind-merge";
import { JsonViewer } from "ui/components/code/JsonViewer";
import { useNavigate } from "ui/lib/routes";
import { Breadcrumbs2 } from "ui/layouts/AppShell/Breadcrumbs2";

export function SettingsHistory() {
   return (
      <Switch>
         <Route path="/" component={SettingsHistoryList} />
         <Route path="/:id" component={SettingsHistoryDetail} />
      </Switch>
   );
}

function SettingsHistoryList() {
   const [history, setHistory] = useState<any[]>([]);
   const [navigate] = useNavigate();

   useEffect(() => {
      fetch("/api/system/config/history")
         .then((res) => res.json())
         .then((data: any) =>
            data.map((item) => ({
               id: item.id,
               timestamp: item.created_at,
               actions: Array.from(new Set(item.json.map((j) => j.t))),
               paths: Array.from(new Set(item.json.map((j) => j.p))),
            })),
         )
         .then(setHistory);
   }, []);

   const onClickRow = (row) => {
      navigate(`/${row.id}`);
   };

   return (
      <>
         <AppShell.SectionHeader>History</AppShell.SectionHeader>
         <AppShell.Scrollable>
            <div className="flex flex-col flex-grow p-3 gap-1">
               <DataTable
                  data={history}
                  renderValue={renderValue}
                  perPage={50}
                  onClickRow={onClickRow}
               />
            </div>
         </AppShell.Scrollable>
      </>
   );
}

const Labels = ({
   items = [],
   max = 3,
   wrap = false,
}: { items: string[]; max?: number; wrap?: boolean }) => {
   const count = items.length;
   if (count > max) {
      items = [...items.slice(0, max), `+${count - max}`];
   }

   return (
      <div className={twMerge("flex gap-1", wrap ? "flex-col items-start" : "flex-row")}>
         {items.map((p, i) => (
            <span
               key={i}
               className="inline-block px-2 py-1.5 text-sm bg-primary/5 rounded font-mono leading-none"
            >
               {p}
            </span>
         ))}
      </div>
   );
};

const renderValue = ({ value, property }) => {
   if (property === "timestamp") {
      return <span>{new Date(value).toLocaleString()}</span>;
   }

   if (property === "actions") {
      return (
         <Labels
            items={value.map((a) => {
               switch (a) {
                  case "a":
                     return "Add";
                  case "r":
                     return "Remove";
                  case "e":
                     return "Edit";
                  default:
                     return "Unknown";
               }
            })}
         />
      );
   }

   if (property === "paths") {
      return <Labels wrap items={value.map((p) => p.join("."))} />;
   }

   return <CellValue value={value} property={property} />;
};

function SettingsHistoryDetail() {
   const { id } = useParams();
   const [item, setItem] = useState<any>();

   useEffect(() => {
      fetch(`/api/system/config/history/${id}`)
         .then((res) => res.json())
         .then(setItem);
   }, []);

   return (
      <>
         <AppShell.SectionHeader className="pl-3">
            <Breadcrumbs2 path={[{ label: "History", href: "/" }, { label: `#${id}` }]} />
         </AppShell.SectionHeader>
         <AppShell.Scrollable>
            <div className="flex flex-col flex-grow p-3 gap-1">
               {item?.json?.map((item, i) => (
                  <DiffItem key={i} item={item} />
               ))}
            </div>
         </AppShell.Scrollable>
      </>
   );
}

const DiffItem = ({ item }: { item: any }) => {
   return (
      <div className="flex flex-col gap-1 w-full border-b border-muted p-3">
         <div className="flex flex-row gap-1 w-full">
            <span className="font-mono">{item.t}</span>
            <span className="font-mono">{item.p.join(".")}</span>
         </div>
         <div className="flex flex-row gap-1 w-full">
            <JsonViewer json={item.o} expand={10} className="w-1/2" title="Old" />
            <JsonViewer json={item.n} expand={10} className="w-1/2" title="New" />
         </div>
      </div>
   );
};
