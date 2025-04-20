import { test, describe } from "bun:test";
import { EntityTypescript } from "data/entities/EntityTypescript";
import { entity, text, em as $em, boolean } from "data/prototype";
import { getDummyConnection } from "../helper";
import { _jsonp } from "core/utils";

describe(EntityTypescript, () => {
   test("...", async () => {
      const schema = $em({
         todo: entity("todo", {
            title: text().required(),
            done: boolean(),
         }),
      });

      const em = schema.proto.withConnection(getDummyConnection().dummyConnection);
      const et = new EntityTypescript(em);

      console.log(_jsonp(et.toTypes()));
      console.log(et.entitiesToTypesString());
   });
});
