import type { Connection } from "bknd/data";

export type SqliteConnection = (config: { url: string }) => Connection;
