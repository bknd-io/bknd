import { TbCopy } from "react-icons/tb";
import { JsonView } from "react-json-view-lite";
import { twMerge } from "tailwind-merge";
import { IconButton } from "../buttons/IconButton";

export const JsonViewer = ({
   json,
   title,
   expand = 0,
   showSize = false,
   showCopy = false,
   copyIconProps = {},
   className,
}: {
   json: object;
   title?: string;
   expand?: number;
   showSize?: boolean;
   showCopy?: boolean;
   copyIconProps?: any;
   className?: string;
}) => {
   const size = showSize ? JSON.stringify(json).length : undefined;
   const showContext = size || title || showCopy;

   function onCopy() {
      navigator.clipboard?.writeText(JSON.stringify(json, null, 2));
   }

   return (
      <div className={twMerge("bg-primary/5 py-3 relative overflow-hidden", className)}>
         {showContext && (
            <div className="absolute right-4 top-3 font-mono text-zinc-400 flex flex-row gap-2 items-center">
               {(title || size) && (
                  <div className="flex flex-row">
                     {title && <span>{title}</span>} {size && <span>({size} Bytes)</span>}
                  </div>
               )}
               {showCopy && (
                  <div>
                     <IconButton Icon={TbCopy} onClick={onCopy} {...copyIconProps} />
                  </div>
               )}
            </div>
         )}
         <JsonView
            data={json}
            shouldExpandNode={(level) => level < expand}
            style={
               {
                  basicChildStyle: "pl-5 ml-1 border-l border-muted hover:border-primary/20",
                  container: "ml-[-10px]",
                  label: "text-primary/90 font-bold font-mono mr-2",
                  stringValue: "text-emerald-500 font-mono select-text",
                  numberValue: "text-sky-400 font-mono",
                  nullValue: "text-zinc-400 font-mono",
                  undefinedValue: "text-zinc-400 font-mono",
                  otherValue: "text-zinc-400 font-mono",
                  booleanValue: "text-orange-400 font-mono",
                  punctuation: "text-zinc-400 font-bold font-mono m-0.5",
                  collapsedContent: "text-zinc-400 font-mono after:content-['...']",
                  collapseIcon:
                     "text-zinc-400 font-mono font-bold text-lg after:content-['▾'] mr-1.5",
                  expandIcon:
                     "text-zinc-400 font-mono font-bold text-lg after:content-['▸'] mr-1.5",
                  noQuotesForStringValues: false,
               } as any
            }
         />
      </div>
   );
};
