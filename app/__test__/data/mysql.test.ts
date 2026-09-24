import { describe, beforeAll, afterAll, test } from "bun:test";
import type { Mysql2Connection } from "data/connection/mysql/Mysql2Connection";
import { mysql2 } from "bknd";
import { createPool } from "mysql2";
import { disableConsoleLog, enableConsoleLog, $waitUntil } from "bknd/utils";
import { $ } from "bun";
import { connectionTestSuite } from "data/connection/connection-test-suite";
import { bunTestRunner } from "adapter/bun/test";

const credentials = {
   host: "127.0.0.1",
   port: 3307,
   user: "mysql",
   password: "mysql",
   database: "bknd",
};

async function cleanDatabase(connection: InstanceType<typeof Mysql2Connection>) {
   const kysely = connection.kysely;

   const tables = await kysely.introspection.getTables();
   for (const table of tables) {
      await kysely.schema.dropTable(table.name).ifExists().execute();
   }
}

async function isMySqlRunning() {
   try {
      // Try to actually connect to MySql
      const conn = mysql2({ pool: createPool(credentials) });
         await conn.ping();
         await conn.close();
      return true;
   } catch (e) {
      return false;
   }
}

describe("mysql", () => {
   beforeAll(async () => {
      if (!(await isMySqlRunning())) {
         await $`docker run --rm --name bknd-test-mysql -d -e MYSQL_ROOT_PASSWORD=${credentials.password} -e MYSQL_USER=${credentials.user} -e MYSQL_PASSWORD=${credentials.password} -e MYSQL_DATABASE=${credentials.database} -e MYSQL_ROOT_HOST=${credentials.host} -p ${credentials.port}:3306 mysql:8`;

         await $waitUntil("MySql is running", isMySqlRunning, 500, 40);
         await new Promise((resolve) => setTimeout(resolve, 500));
      }

      disableConsoleLog();
   }, 120000);
   afterAll(async () => {
      if (await isMySqlRunning()) {
         try {
            await $`docker stop bknd-test-mysql`;
         } catch (e) { }
      }

      enableConsoleLog();
   });

   describe.serial.each([
      ["mysql2", () => mysql2({ pool: createPool(credentials) })]])("%s", (name, createConnection) => {
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
