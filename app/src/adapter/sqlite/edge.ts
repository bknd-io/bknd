import { type Connection, libsql } from "bknd/data";

export function sqlite(config: { url: string }): Connection {
   return libsql(config);
}
