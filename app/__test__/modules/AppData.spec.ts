import { beforeEach, describe, expect, test } from "bun:test";
import { parse } from "core/utils/schema";
import { fieldsSchema } from "../../src/data/data-schema";
import { AppData, type ModuleBuildContext } from "../../src/modules";
import { makeCtx, moduleTestSuite } from "./module-test-suite";
import * as proto from "data/prototype";

describe("AppData", () => {
   moduleTestSuite(AppData);

   let ctx: ModuleBuildContext;
   beforeEach(() => {
      ctx = makeCtx();
   });

   test("field config construction", () => {
      expect(parse(fieldsSchema, { type: "text" })).toBeDefined();
   });

   test("should prevent multi-deletion of entities in single request", async () => {
      const schema = proto.em({
         one: proto.entity("one", {
            text: proto.text(),
         }),
         two: proto.entity("two", {
            text: proto.text(),
         }),
         three: proto.entity("three", {
            text: proto.text(),
         }),
      });
      const check = () => {
         const expected = ["one", "two", "three"];
         const fromConfig = Object.keys(data.config.entities ?? {});
         const fromEm = data.em.entities.map((e) => e.name);
         expect(fromConfig).toEqual(expected);
         expect(fromEm).toEqual(expected);
      };

      // auth must be enabled, otherwise default config is returned
      const data = new AppData(schema.toJSON(), ctx);
      await data.build();
      check();

      expect(data.schema().remove("entities")).rejects.toThrow(/more than one entity/);
      check();

      await data.setContext(makeCtx()).build();
      check();
   });
});
