import type { Connection } from "bknd/data";
import { nodeSqlite } from "../node/connection/NodeSqliteConnection";

export function sqlite(config: { url: string }): Connection {
   return nodeSqlite(config);
}
