import { describe, test, expect } from "vitest";
import type { TAppDataField } from "data/data-schema";
import { getCustomHandlerInfo } from "../../utils/field-utils";

describe("CustomHandlerIndicator logic", () => {
   test("should detect non-primary fields correctly", () => {
      const textField: TAppDataField = {
         type: "text",
         config: {}
      };
      
      const info = getCustomHandlerInfo(textField);
      expect(info.hasCustomHandler).toBe(false);
   });

   test("should detect primary fields without custom handlers", () => {
      const primaryField: TAppDataField = {
         type: "primary",
         config: {
            format: "integer"
         }
      };
      
      const info = getCustomHandlerInfo(primaryField);
      expect(info.hasCustomHandler).toBe(false);
   });

   test("should detect custom handler for function type", () => {
      const customPrimaryField: TAppDataField = {
         type: "primary",
         config: {
            format: "custom",
            customHandler: {
               type: "function",
               handler: () => "test"
            }
         }
      };
      
      const info = getCustomHandlerInfo(customPrimaryField);
      expect(info.hasCustomHandler).toBe(true);
      expect(info.handlerType).toBe("function");
      expect(info.displayName).toBe("Function");
   });

   test("should detect custom handler for import type", () => {
      const importPrimaryField: TAppDataField = {
         type: "primary",
         config: {
            format: "custom",
            customHandler: {
               type: "import",
               importPath: "./handlers/my-handler.js",
               functionName: "generateId"
            }
         }
      };
      
      const info = getCustomHandlerInfo(importPrimaryField);
      expect(info.hasCustomHandler).toBe(true);
      expect(info.handlerType).toBe("import");
      expect(info.displayName).toBe("my-handler.js:generateId");
   });

   test("should handle import without function name", () => {
      const importPrimaryField: TAppDataField = {
         type: "primary",
         config: {
            format: "custom",
            customHandler: {
               type: "import",
               importPath: "./handlers/default-handler.js"
            }
         }
      };
      
      const info = getCustomHandlerInfo(importPrimaryField);
      expect(info.hasCustomHandler).toBe(true);
      expect(info.handlerType).toBe("import");
      expect(info.displayName).toBe("default-handler.js");
   });
});