import type { DB } from "bknd/core";
import type { Insertable, Selectable, Updateable, Generated } from "kysely";

declare global {
  type BkndEntity<T extends keyof DB> = Selectable<DB[T]>;
  type BkndEntityCreate<T extends keyof DB> = Insertable<DB[T]>;
  type BkndEntityUpdate<T extends keyof DB> = Updateable<DB[T]>;
}

interface Database {
}

declare module "bknd/core" {
  interface DB extends Database {}
}