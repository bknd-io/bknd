import { DialectAdapterBase } from "kysely";

/**
 * DuckDB supports transactional DDL (CREATE/ALTER TABLE can be rolled back)
 * and `INSERT|UPDATE|DELETE ... RETURNING`.
 */
export class DuckdbAdapter extends DialectAdapterBase {
   override get supportsTransactionalDdl(): boolean {
      return true;
   }

   override get supportsReturning(): boolean {
      return true;
   }

   override async acquireMigrationLock(): Promise<void> {
      // single embedded instance, no cross-process migration lock needed
   }

   override async releaseMigrationLock(): Promise<void> {}
}
