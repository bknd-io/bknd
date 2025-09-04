import { describe, expect, test } from "bun:test";
import { PrimaryField } from "data/fields";

describe("[data] PrimaryField", async () => {
   const field = new PrimaryField("primary");

   test("name", async () => {
      expect(field.name).toBe("primary");
   });

   test("schema", () => {
      expect(field.name).toBe("primary");
      expect(field.schema()).toEqual({
         name: "primary",
         type: "integer" as const,
         nullable: false,
         primary: true,
      });
   });

   test("hasDefault", async () => {
      expect(field.hasDefault()).toBe(false);
      expect(field.getDefault()).toBe(undefined);
   });

   test("isFillable", async () => {
      expect(field.isFillable()).toBe(false);
   });

   test("isHidden", async () => {
      expect(field.isHidden()).toBe(false);
   });

   test("isRequired", async () => {
      expect(field.isRequired()).toBe(false);
   });

   test("transformPersist/Retrieve", async () => {
      expect(field.transformPersist(1)).rejects.toThrow();
      expect(field.transformRetrieve(1)).toBe(1);
   });

   test("format", () => {
      const uuid = new PrimaryField("uuid", { format: "uuid" });
      expect(uuid.format).toBe("uuid");
      expect(uuid.fieldType).toBe("text");
      expect(uuid.getNewValue()).toBeString();
      expect(uuid.toType()).toEqual({
         required: true,
         comment: undefined,
         type: "Generated<string>",
         import: [{ package: "kysely", name: "Generated" }],
      });

      const integer = new PrimaryField("integer", { format: "integer" });
      expect(integer.format).toBe("integer");
      expect(integer.fieldType).toBe("integer");
      expect(integer.getNewValue()).toBeUndefined();
      expect(integer.toType()).toEqual({
         required: true,
         comment: undefined,
         type: "Generated<number>",
         import: [{ package: "kysely", name: "Generated" }],
      });
   });

   test("custom format", () => {
      // Test custom format with function handler
      const customHandler = (entity: string) => `${entity}_${Date.now()}`;
      const customField = new PrimaryField("custom", {
         format: "custom",
         customHandler: {
            type: "function",
            handler: customHandler,
         },
      });

      expect(customField.format).toBe("custom");
      expect(customField.fieldType).toBe("text");
      expect(customField.isCustomFormat()).toBe(true);
      const handler = customField.getCustomHandler();
      expect(handler?.type).toBe("function");
      expect(typeof handler?.handler).toBe("function");
      expect(customField.getNewValue()).toBeUndefined(); // Custom generation handled elsewhere

      // Test custom format with import handler
      const importField = new PrimaryField("import", {
         format: "custom",
         customHandler: {
            type: "import",
            importPath: "./handlers/customId",
            functionName: "generateId",
         },
      });

      expect(importField.isCustomFormat()).toBe(true);
      expect(importField.getCustomHandler()).toEqual({
         type: "import",
         importPath: "./handlers/customId",
         functionName: "generateId",
      });
   });

   test("custom format validation", () => {
      // Should throw when custom format is used without handler
      expect(() => {
         new PrimaryField("invalid", { format: "custom" });
      }).toThrow("Custom handler configuration is required when format is 'custom'");

      // Should throw when function type is used without handler function
      expect(() => {
         new PrimaryField("invalid", {
            format: "custom",
            customHandler: { type: "function" },
         });
      }).toThrow("Handler function is required when type is 'function'");

      // Should throw when import type is used without import path
      expect(() => {
         new PrimaryField("invalid", {
            format: "custom",
            customHandler: { type: "import" },
         });
      }).toThrow("Import path is required when type is 'import'");

      // Should handle import type without function name (uses default export)
      const field = new PrimaryField("invalid", {
         format: "custom",
         customHandler: {
            type: "import",
            importPath: "./handlers/customId",
         },
      });
      
      // The field should be created but validation errors should occur at runtime
      expect(field.format).toBe("custom");
   });
});
