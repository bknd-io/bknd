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
});
