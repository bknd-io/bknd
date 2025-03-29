import { describe, expect, test } from "bun:test";
import { DateField } from "../../../../src/data";
import { fieldTestSuite } from "data/fields/field-test-suite";

describe("[data] DateField", async () => {
   fieldTestSuite({ expect, test }, DateField, { defaultValue: new Date(), schemaType: "date" });

   // @todo: add datefield tests
   test("week", async () => {
      const field = new DateField("test", { type: "week" });
      console.log(field.getValue("2021-W01", "submit"));
   });
});
