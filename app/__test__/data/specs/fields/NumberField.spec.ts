import { bunTestRunner } from "adapter/bun/test";
import { describe, expect, test } from "bun:test";
import { NumberField } from "data/fields";
import { fieldTestSuite, transformPersist } from "data/fields/field-test-suite";

describe("[data] NumberField", async () => {
   test("transformPersist (config)", async () => {
      const field = new NumberField("test", { minimum: 3, maximum: 5 });

      expect(transformPersist(field, 2)).rejects.toThrow();
      expect(transformPersist(field, 6)).rejects.toThrow();
      expect(transformPersist(field, 4)).resolves.toBe(4);

      const field2 = new NumberField("test");
      expect(transformPersist(field2, 0)).resolves.toBe(0);
      expect(transformPersist(field2, 10000)).resolves.toBe(10000);
   });

   fieldTestSuite(bunTestRunner, NumberField, { defaultValue: 12, schemaType: "integer" });
});
