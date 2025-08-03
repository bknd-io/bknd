import { describe, expect, test } from "bun:test";
import { TextField } from "data/fields";
import { fieldTestSuite, transformPersist } from "data/fields/field-test-suite";
import { bunTestRunner } from "adapter/bun/test";

describe("[data] TextField", async () => {
   test("transformPersist (config)", async () => {
      const field = new TextField("test", { minLength: 3, maxLength: 5 });

      expect(transformPersist(field, "a")).rejects.toThrow();
      expect(transformPersist(field, "abcdefghijklmn")).rejects.toThrow();
      expect(transformPersist(field, "abc")).resolves.toBe("abc");
   });

   fieldTestSuite(bunTestRunner, TextField, { defaultValue: "abc", schemaType: "text" });
});
