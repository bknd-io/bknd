import type { TAppDataField } from "data/data-schema";

/**
 * Check if a field uses custom ID generation
 */
export function isCustomIdField(field: TAppDataField): boolean {
   if (field.type !== "primary") return false;
   
   const config = field.config as any;
   return config?.format === "custom" && !!config?.customHandler;
}

/**
 * Get the format type for a primary field
 */
export function getPrimaryFieldFormat(field: TAppDataField): string | undefined {
   if (field.type !== "primary") return undefined;
   
   const config = field.config as any;
   return config?.format || "integer";
}

/**
 * Get custom handler info for display
 */
export function getCustomHandlerInfo(field: TAppDataField): {
   hasCustomHandler: boolean;
   handlerType?: "function" | "import";
   displayName?: string;
} {
   if (!isCustomIdField(field)) {
      return { hasCustomHandler: false };
   }
   
   const config = field.config as any;
   const handler = config?.customHandler;
   
   if (!handler) {
      return { hasCustomHandler: false };
   }
   
   let displayName = "Custom";
   if (handler.type === "import" && handler.importPath) {
      // Extract filename from import path for display
      const pathParts = handler.importPath.split("/");
      const filename = pathParts[pathParts.length - 1];
      displayName = handler.functionName ? `${filename}:${handler.functionName}` : filename;
   } else if (handler.type === "function") {
      displayName = "Function";
   }
   
   return {
      hasCustomHandler: true,
      handlerType: handler.type,
      displayName,
   };
}