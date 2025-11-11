import { describe, beforeAll, afterAll, test } from "bun:test";
import type { PostgresConnection } from "data/connection/postgres";
import { pg, postgresJs } from "bknd";
import { Pool } from "pg";
import postgres from 'postgres'
import { disableConsoleLog, enableConsoleLog, $waitUntil } from "bknd/utils";
import { $ } from "bun";
import { connectionTestSuite } from "data/connection/connection-test-suite";
import { bunTestRunner } from "adapter/bun/test";

const credentials = {
   host: "localhost",
   port: 5430,
   user: "postgres",
   password: "postgres",
   database: "bknd",
};

async function cleanDatabase(connection: InstanceType<typeof PostgresConnection>) {
   const kysely = connection.kysely;

   // drop all tables+indexes & create new schema
   await kysely.schema.dropSchema("public").ifExists().cascade().execute();
   await kysely.schema.dropIndex("public").ifExists().cascade().execute();
   await kysely.schema.createSchema("public").execute();
}

async function isPostgresRunning() {
   try {
      // Try to actually connect to PostgreSQL
      const conn = pg({ pool: new Pool(credentials) });
      await conn.ping();
      await conn.close();
      return true;
   } catch (e) {
      return false;
   }
}

describe("postgres", () => {
   beforeAll(async () => {
      if (!(await isPostgresRunning())) {
         await $`docker run --rm --name bknd-test-postgres -d -e POSTGRES_PASSWORD=${credentials.password} -e POSTGRES_USER=${credentials.user} -e POSTGRES_DB=${credentials.database} -p ${credentials.port}:5432 postgres:17`;
         await $waitUntil("Postgres is running", isPostgresRunning);
         await new Promise((resolve) => setTimeout(resolve, 500));
      }

      disableConsoleLog();
   });
   afterAll(async () => {
      if (await isPostgresRunning()) {
         try {
            await $`docker stop bknd-test-postgres`;
         } catch (e) {}
      }

      enableConsoleLog();
   });

   describe.serial.each([
      ["pg", () => pg({ pool: new Pool(credentials) })],
      ["postgresjs", () => postgresJs({ postgres: postgres(credentials) })],
   ])("%s", (name, createConnection) => {
      connectionTestSuite(
         {
            ...bunTestRunner,
            test: test.serial,
         },
         {
            makeConnection: () => {
               const connection = createConnection();
               return {
                  connection,
                  dispose: async () => {
                     await cleanDatabase(connection);
                     await connection.close();
                  },
               };
            },
            rawDialectDetails: [],
            disableConsoleLog: false,
         },
      );
   });
});
