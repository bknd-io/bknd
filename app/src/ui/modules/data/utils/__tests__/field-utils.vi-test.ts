import { describe, test, expect } from "vitest";
import { isCustomIdField, getPrimaryFieldFormat, getCustomHandlerInfo } from "../field-utils";
import type { TAppDataField } from "data/data-schema";

describe("field-utils", () => {
   test("isCustomIdField should return false for non-primary fields", () => {
      const textField: TAppDataField = {
         type: "text",
         config: {}
      };
      
      expect(isCustomIdField(textField)).toBe(false);
   });

   test("isCustomIdField should return false for primary fields without custom handler", () => {
      const primaryField: TAppDataField = {
         type: "primary",
         config: {
            format: "integer"
         }
      };
      
      expect(isCustomIdField(primaryField)).toBe(false);
   });

   test("isCustomIdField should return true for primary fields with custom handler", () => {
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
      
      expect(isCustomIdField(customPrimaryField)).toBe(true);
   });

   test("getPrimaryFieldFormat should return undefined for non-primary fields", () => {
      const textField: TAppDataField = {
         type: "text",
         config: {}
      };
      
      expect(getPrimaryFieldFormat(textField)).toBeUndefined();
   });

   test("getPrimaryFieldFormat should return format for primary fields", () => {
      const primaryField: TAppDataField = {
         type: "primary",
         config: {
            format: "uuid"
         }
      };
      
      expect(getPrimaryFieldFormat(primaryField)).toBe("uuid");
   });

   test("getCustomHandlerInfo should return correct info for custom handlers", () => {
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

   test("getCustomHandlerInfo should return correct info for import handlers", () => {
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
});