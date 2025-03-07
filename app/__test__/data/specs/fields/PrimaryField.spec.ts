import { describe, expect, test } from "bun:test";
import { PrimaryField } from "../../../../src/data";

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
});
