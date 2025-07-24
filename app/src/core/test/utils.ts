import { createApp as createAppInternal, type CreateAppConfig } from "App";
import { bunSqlite } from "adapter/bun/connection/BunSqliteConnection";
import { Connection } from "data/connection/Connection";

export { App } from "App";

export function createApp({ connection, ...config }: CreateAppConfig = {}) {
   return createAppInternal({
      ...config,
      connection: Connection.isConnection(connection) ? connection : bunSqlite(connection as any),
   });
}
