import { bunTestRunner } from "adapter/bun/test";
import { describe, expect, test } from "bun:test";
import { JsonField } from "data/fields";
import { fieldTestSuite, transformPersist } from "data/fields/field-test-suite";

describe("[data] JsonField", async () => {
   const field = new JsonField("test");
   fieldTestSuite(bunTestRunner, JsonField, {
      defaultValue: { a: 1 },
      sampleValues: ["string", { test: 1 }, 1],
      schemaType: "text",
   });

   test("transformPersist (no config)", async () => {
      expect(transformPersist(field, Function)).rejects.toThrow();
      expect(transformPersist(field, undefined)).resolves.toBeUndefined();
   });

   test("isSerializable", async () => {
      expect(field.isSerializable(1)).toBe(true);
      expect(field.isSerializable("test")).toBe(true);
      expect(field.isSerializable({ test: 1 })).toBe(true);
      expect(field.isSerializable({ test: [1, 2] })).toBe(true);
      expect(field.isSerializable(Function)).toBe(false);
      expect(field.isSerializable(undefined)).toBe(false);
   });

   test("isSerialized", async () => {
      expect(field.isSerialized(1)).toBe(false);
      expect(field.isSerialized({ test: 1 })).toBe(false);
      expect(field.isSerialized('{"test":1}')).toBe(true);
      expect(field.isSerialized("1")).toBe(true);
   });

   test("getValue", async () => {
      expect(field.getValue({ test: 1 }, "form")).toBe('{\n  "test": 1\n}');
      expect(field.getValue("string", "form")).toBe('"string"');
      expect(field.getValue(1, "form")).toBe("1");

      expect(field.getValue('{"test":1}', "submit")).toEqual({ test: 1 });
      expect(field.getValue('"string"', "submit")).toBe("string");
      expect(field.getValue("1", "submit")).toBe(1);

      expect(field.getValue({ test: 1 }, "table")).toBe('{"test":1}');
      expect(field.getValue("string", "table")).toBe('"string"');
      expect(field.getValue(1, "form")).toBe("1");
   });
});
