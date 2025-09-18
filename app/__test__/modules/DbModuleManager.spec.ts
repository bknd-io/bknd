import { it, expect, describe } from "bun:test";
import { DbModuleManager } from "modules/db/DbModuleManager";
import { getDummyConnection } from "../helper";
import { TABLE_NAME } from "modules/db/migrations";

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

   it("should work with initial secrets", async () => {
      const { dummyConnection } = getDummyConnection(false);
      const db = dummyConnection.kysely;
      const m = new DbModuleManager(dummyConnection, {
         initial: {
            auth: {
               enabled: true,
               jwt: {
                  secret: "",
               },
            },
         },
         secrets: {
            "auth.jwt.secret": "test",
         },
      });
      await m.build();
      expect(m.toJSON(true).auth.jwt.secret).toBe("test");

      const getSecrets = () =>
         db
            .selectFrom(TABLE_NAME)
            .selectAll()
            .where("type", "=", "secrets")
            .executeTakeFirst()
            .then((r) => r?.json);

      expect(await getSecrets()).toEqual({ "auth.jwt.secret": "test" });

      // also after rebuild
      await m.build();
      await m.save();
      expect(await getSecrets()).toEqual({ "auth.jwt.secret": "test" });

      // and ignore if already present
      const m2 = new DbModuleManager(dummyConnection, {
         initial: {
            auth: {
               enabled: true,
               jwt: {
                  secret: "",
               },
            },
         },
         secrets: {
            "auth.jwt.secret": "something completely different",
         },
      });
      await m2.build();
      await m2.save();
      expect(await getSecrets()).toEqual({ "auth.jwt.secret": "test" });
   });
});
