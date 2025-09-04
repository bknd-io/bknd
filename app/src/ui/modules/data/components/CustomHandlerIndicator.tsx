import { TbSettings, TbKey } from "react-icons/tb";
import { Tooltip } from "@mantine/core";
import type { TAppDataField } from "data/data-schema";
import { getCustomHandlerInfo } from "../utils/field-utils";

interface CustomHandlerIndicatorProps {
   field: TAppDataField;
   size?: "sm" | "md" | "lg";
   showLabel?: boolean;
}

/**
 * Component to display custom handler indicators for primary fields
 */
export function CustomHandlerIndicator({ 
   field, 
   size = "md", 
   showLabel = false 
}: CustomHandlerIndicatorProps) {
   if (field.type !== "primary") return null;
   
   const customHandlerInfo = getCustomHandlerInfo(field);
   
   if (!customHandlerInfo.hasCustomHandler) {
      return showLabel ? (
         <div className="flex items-center gap-1">
            <TbKey className={`${size === "sm" ? "w-3 h-3" : size === "lg" ? "w-5 h-5" : "w-4 h-4"} text-yellow-700`} />
            {showLabel && <span className="text-sm text-muted-foreground">Primary</span>}
         </div>
      ) : null;
   }
   
   const iconSize = size === "sm" ? "w-3 h-3" : size === "lg" ? "w-5 h-5" : "w-4 h-4";
   
   return (
      <Tooltip 
         label={`Custom ID Handler: ${customHandlerInfo.displayName}`}
         position="top"
      >
         <div className="flex items-center gap-1">
            <div className="relative">
               <TbKey className={`${iconSize} text-yellow-700`} />
               <TbSettings className={`absolute -top-0.5 -right-0.5 ${size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5"} text-purple-600 bg-white rounded-full`} />
            </div>
            {showLabel && (
               <span className="text-sm text-purple-600 font-medium">
                  {customHandlerInfo.displayName}
               </span>
            )}
         </div>
      </Tooltip>
   );
}

/**
 * Simple badge component for custom handler status
 */
export function CustomHandlerBadge({ field }: { field: TAppDataField }) {
   if (field.type !== "primary") return null;
   
   const customHandlerInfo = getCustomHandlerInfo(field);
   
   if (!customHandlerInfo.hasCustomHandler) return null;
   
   return (
      <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
         <TbSettings className="w-3 h-3" />
         Custom ID
      </div>
   );
}