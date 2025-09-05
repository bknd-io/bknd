import { it, expect, describe } from "bun:test";
import { DbModuleManager } from "modules/db/DbModuleManager";
import { getDummyConnection } from "../helper";

describe("DbModuleManager", () => {
   it("should extract secrets", async () => {
      const { dummyConnection } = getDummyConnection(false);
      const m = new DbModuleManager(dummyConnection, {
         initial: {
            auth: {
               enabled: true,
               jwt: {
                  secret: "test",
               },
            },
         },
      });
      await m.build();
      expect(m.toJSON(true).auth.jwt.secret).toBe("test");
      await m.save();
   });
});
