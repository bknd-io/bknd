import type { Connection } from "bknd/data";
import { libsql } from "../../data/connection/sqlite/libsql/LibsqlConnection";

export function sqlite(config: { url: string }): Connection {
   return libsql(config);
}
