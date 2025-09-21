import { describe, it, expect } from "bun:test";
import { EntityTypescript } from "./EntityTypescript";
import * as proto from "../prototype";
import { getDummyConnection } from "../../../__test__/data/helper";

describe("EntityTypescript", () => {
   it("should generate correct typescript for system entities", () => {
      const schema = proto.em(
         {
            test: proto.entity("test", {
               name: proto.text(),
            }),
            users: proto.systemEntity("users", {
               name: proto.text(),
            }),
         },
         ({ relation }, { test, users }) => {
            relation(test).manyToOne(users);
         },
      );
      const { dummyConnection } = getDummyConnection();
      const et = new EntityTypescript(schema.proto.withConnection(dummyConnection));
      expect(et.toString()).toContain('users?: DB["users"];');
   });
});
