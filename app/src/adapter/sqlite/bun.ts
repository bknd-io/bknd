import type { Connection } from "bknd/data";
import { bunSqlite } from "../bun/connection/BunSqliteConnection";

export function sqlite(config?: { url: string }): Connection {
   return bunSqlite(config);
}
