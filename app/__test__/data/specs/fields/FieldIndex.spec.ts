import { describe, expect, test } from "bun:test";
import { Entity } from "data/entities";
import { Field, EntityIndex } from "data/fields";
import { s } from "core/utils/schema";

class TestField extends Field {
   protected getSchema(): any {
      return s.any();
   }

   override schema() {
      return undefined as any;
   }
}

describe("FieldIndex", async () => {
   const entity = new Entity("test", []);
   test("it constructs", async () => {
      const field = new TestField("name");
      const index = new EntityIndex(entity, [field]);

      expect(index.fields).toEqual([field]);
      expect(index.name).toEqual("idx_test_name");
      expect(index.unique).toEqual(false);
   });

   test("it fails on non-unique", async () => {
      const field = new TestField("name", { required: false });

      expect(() => new EntityIndex(entity, [field], true)).toThrowError();
      expect(() => new EntityIndex(entity, [field])).toBeDefined();
   });
});
