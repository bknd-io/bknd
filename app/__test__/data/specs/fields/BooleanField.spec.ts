import { bunTestRunner } from "adapter/bun/test";
import { describe, expect, test } from "bun:test";
import { BooleanField } from "data/fields";
import { fieldTestSuite, transformPersist } from "data/fields/field-test-suite";

describe("[data] BooleanField", async () => {
   fieldTestSuite(bunTestRunner, BooleanField, { defaultValue: true, schemaType: "boolean" });

   test("transformRetrieve", async () => {
      const field = new BooleanField("test");
      expect(field.transformRetrieve(1)).toBe(true);
      expect(field.transformRetrieve(0)).toBe(false);
      expect(field.transformRetrieve("1")).toBe(true);
      expect(field.transformRetrieve("0")).toBe(false);
      expect(field.transformRetrieve(true)).toBe(true);
      expect(field.transformRetrieve(false)).toBe(false);
      expect(field.transformRetrieve(null)).toBe(null);
      expect(field.transformRetrieve(undefined)).toBe(null);
   });

   test("transformPersist (specific)", async () => {
      const field = new BooleanField("test");
      expect(transformPersist(field, 1)).resolves.toBe(true);
      expect(transformPersist(field, 0)).resolves.toBe(false);
      expect(transformPersist(field, "1")).rejects.toThrow();
      expect(transformPersist(field, "0")).rejects.toThrow();
      expect(transformPersist(field, true)).resolves.toBe(true);
      expect(transformPersist(field, false)).resolves.toBe(false);
   });
});
