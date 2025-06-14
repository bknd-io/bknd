import { type SqliteDatabase, SqliteDialect } from "kysely";
import { SqliteConnection } from "./SqliteConnection";

export class SqliteLocalConnection extends SqliteConnection<SqliteDatabase> {
   override name = "sqlite-local";

   constructor(database: SqliteDatabase) {
      super({
         dialect: SqliteDialect,
         dialectArgs: [{ database }],
      });
      this.client = database;
   }
}
