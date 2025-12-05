import type { DB } from "bknd";
import type { Insertable, Selectable, Updateable, Generated } from "kysely";

declare global {
  type BkndEntity<T extends keyof DB> = Selectable<DB[T]>;
  type BkndEntityCreate<T extends keyof DB> = Insertable<DB[T]>;
  type BkndEntityUpdate<T extends keyof DB> = Updateable<DB[T]>;
}

export interface Todos {
  id: Generated<number>;
  title?: string;
  done?: boolean;
}

interface Database {
  todos: Todos;
}

declare module "bknd" {
  interface DB extends Database {}
}