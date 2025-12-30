import { TbCopy } from "react-icons/tb";
import { JsonView } from "react-json-view-lite";
import { twMerge } from "tailwind-merge";
import { IconButton } from "../buttons/IconButton";
import ErrorBoundary from "ui/components/display/ErrorBoundary";
import { forwardRef, useImperativeHandle, useState } from "react";
import { formatNumber } from "bknd/utils";

export type JsonViewerProps = {
   json: object | null;
   title?: string;
   expand?: number;
   showSize?: boolean;
   showCopy?: boolean;
   copyIconProps?: any;
   className?: string;
};

const style = {
   basicChildStyle: "pl-5 ml-1 border-l border-muted hover:border-primary/20",
   container: "ml-[-10px]",
   label: "text-primary/90 font-bold font-mono mr-2",
   stringValue:
      "text-emerald-600 dark:text-emerald-500 font-mono select-text text-wrap whitespace-wrap break-words",
   numberValue: "text-sky-500 dark:text-sky-400 font-mono select-text",
   nullValue: "text-zinc-400 font-mono",
   undefinedValue: "text-zinc-400 font-mono",
   otherValue: "text-zinc-400 font-mono",
   booleanValue: "text-orange-500 dark:text-orange-400 font-mono",
   punctuation: "text-zinc-400 font-bold font-mono m-0.5",
   collapsedContent: "text-zinc-400 font-mono after:content-['...']",
   collapseIcon: "text-zinc-400 font-mono font-bold text-lg after:content-['▾'] mr-1.5",
   expandIcon: "text-zinc-400 font-mono font-bold text-lg after:content-['▸'] mr-1.5",
   noQuotesForStringValues: false,
} as any;

export const JsonViewer = ({
   json,
   title,
   expand = 0,
   showSize = false,
   showCopy = false,
   copyIconProps = {},
   className,
}: JsonViewerProps) => {
   const size = showSize ? (!json ? 0 : JSON.stringify(json).length) : undefined;
   const formattedSize = formatNumber.fileSize(size ?? 0);
   const showContext = size || title || showCopy;

   function onCopy() {
      navigator.clipboard?.writeText(JSON.stringify(json, null, 2));
   }

   return (
      <div className={twMerge("bg-primary/5 py-3 relative overflow-hidden", className)}>
         {showContext && (
            <div className="absolute right-4 top-3 font-mono text-zinc-400 flex flex-row gap-2 items-center">
               {(title || size !== undefined) && (
                  <div className="flex flex-row">
                     {title && <span>{title}</span>}{" "}
                     {size !== undefined && <span>({formattedSize})</span>}
                  </div>
               )}
               {showCopy && (
                  <div>
                     <IconButton Icon={TbCopy} onClick={onCopy} {...copyIconProps} />
                  </div>
               )}
            </div>
         )}
         <ErrorBoundary>
            <JsonView
               data={json as any}
               shouldExpandNode={(level) => level < expand}
               style={style}
            />
         </ErrorBoundary>
      </div>
   );
};

export type JsonViewerTabsProps = Omit<JsonViewerProps, "json"> & {
   selected?: string;
   tabs: {
      [key: string]: JsonViewerProps & {
         enabled?: boolean;
      };
   };
};

export type JsonViewerTabsRef = {
   setSelected: (selected: string) => void;
};

export const JsonViewerTabs = forwardRef<JsonViewerTabsRef, JsonViewerTabsProps>(
   ({ tabs: _tabs, ...defaultProps }, ref) => {
      const tabs = Object.fromEntries(
         Object.entries(_tabs).filter(([_, v]) => v.enabled !== false),
      );
      const [selected, setSelected] = useState(defaultProps.selected ?? Object.keys(tabs)[0]);

      useImperativeHandle(ref, () => ({
         setSelected,
      }));

      return (
         <div className="flex flex-col bg-primary/5 rounded-md flex-shrink-0">
            <div className="flex flex-row gap-4 border-b px-3 border-primary/10 min-w-0">
               {Object.keys(tabs).map((key) => (
                  <button
                     key={key}
                     type="button"
                     className={twMerge(
                        "flex flex-row text-sm cursor-pointer py-3 pt-3.5 px-1 border-b border-transparent -mb-px transition-opacity flex-shrink-0",
                        selected === key ? "border-primary" : "opacity-50 hover:opacity-70",
                     )}
                     onClick={() => setSelected(key)}
                  >
                     <span className="font-mono leading-none truncate">{key}</span>
                  </button>
               ))}
            </div>
            {/* @ts-ignore */}
            <JsonViewer
               className="bg-transparent overflow-x-auto"
               {...defaultProps}
               {...tabs[selected as any]}
               title={undefined}
            />
         </div>
      );
   },
);
