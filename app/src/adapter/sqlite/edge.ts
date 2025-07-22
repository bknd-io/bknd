import { type Connection, libsql } from "bknd";

export function sqlite(config: { url: string }): Connection {
   return libsql(config);
}
