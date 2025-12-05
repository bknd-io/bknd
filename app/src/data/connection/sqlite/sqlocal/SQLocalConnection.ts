import { Kysely, ParseJSONResultsPlugin } from "kysely";
import { SqliteConnection } from "../SqliteConnection";
import { SqliteIntrospector } from "../SqliteIntrospector";
import type { DB } from "bknd";
import type { SQLocalKysely } from "sqlocal/kysely";

const plugins = [new ParseJSONResultsPlugin()];

export class SQLocalConnection extends SqliteConnection<SQLocalKysely> {
   private connected: boolean = false;

   constructor(client: SQLocalKysely) {
      // @ts-expect-error - config is protected
      client.config.onConnect = () => {
         // we need to listen for the connection, it will be awaited in init()
         this.connected = true;
      };
      super({
         kysely: new Kysely<any>({
            dialect: {
               ...client.dialect,
               createIntrospector: (db: Kysely<DB>) => {
                  return new SqliteIntrospector(db as any, {
                     plugins,
                  });
               },
            },
            plugins,
         }) as any,
      });
      this.client = client;
   }

   override async init() {
      if (this.initialized) return;
      let tries = 0;
      while (!this.connected && tries < 100) {
         tries++;
         await new Promise((resolve) => setTimeout(resolve, 5));
      }
      if (!this.connected) {
         throw new Error("Failed to connect to SQLite database");
      }
      this.initialized = true;
   }
}

export function sqlocal(instance: InstanceType<typeof SQLocalKysely>): SQLocalConnection {
   return new SQLocalConnection(instance);
}
