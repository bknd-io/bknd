import { describe } from "bun:test";
import { postgresJs } from "../src/PostgresJsConnection";
import { testSuite } from "./suite";

describe("postgresjs", () => {
   testSuite({
      createConnection: () =>
         postgresJs({
            host: "localhost",
            port: 5430,
            user: "postgres",
            password: "postgres",
            database: "bknd",
         }),
   });
});
