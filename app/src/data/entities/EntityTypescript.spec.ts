import { describe, it, expect } from "bun:test";
import { EntityTypescript } from "./EntityTypescript";
import * as proto from "../prototype";
import { DummyConnection } from "../connection/Connection";

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
      const et = new EntityTypescript(schema.proto.withConnection(new DummyConnection()));
      expect(et.toString()).toContain('users?: DB["users"];');
   });
});
