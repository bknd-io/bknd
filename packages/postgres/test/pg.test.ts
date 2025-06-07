import { describe } from "bun:test";
import { pg } from "../src/PgPostgresConnection";
import { testSuite } from "./suite";

describe("pg", () => {
   testSuite({
      createConnection: () =>
         pg({
            host: "localhost",
            port: 5430,
            user: "postgres",
            password: "postgres",
            database: "bknd",
         }),
   });
});
