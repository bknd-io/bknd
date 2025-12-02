import { describe, expect, it } from "vitest";
import { SQLocalConnection } from "../src";
import type { ClientConfig } from "sqlocal";
import { SQLocalKysely } from "sqlocal/kysely";

describe(SQLocalConnection, () => {
   function create(config: ClientConfig = { databasePath: ":memory:" }) {
      return new SQLocalConnection(new SQLocalKysely(config));
   }

   it("constructs", async () => {
      const connection = create();
      await connection.init();
      expect(connection.client).toBeDefined();
      expect(await connection.client.sql`SELECT 1`).toEqual([{ "1": 1 }]);
   });
});
