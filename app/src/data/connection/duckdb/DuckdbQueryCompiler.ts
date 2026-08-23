import {
   type AlterTableNode,
   type ColumnDefinitionNode,
   type CreateTableNode,
   type LimitNode,
   type OffsetNode,
   type OperationNode,
   SqliteQueryCompiler,
} from "kysely";

/**
 * DuckDB shares SQLite's surface for the parts kysely emits (`?` placeholders,
 * `"` quoted identifiers), but has no `AUTOINCREMENT` and its `GENERATED AS
 * IDENTITY` columns are not implemented alongside constraints (DuckDB 1.4/1.5
 * throw "Constraint not implemented!"). The supported auto-increment pattern
 * is a sequence-backed column default:
 *
 *    create sequence if not exists "seq_test_id";
 *    create table "test" (
 *      "id" bigint default nextval('seq_test_id') not null primary key, ...
 *    );
 *
 * The sequence DDL is prepended to the same compiled statement — DuckDB
 * executes multi-statement strings in one call, and DDL carries no bound
 * parameters.
 */
export class DuckdbQueryCompiler extends SqliteQueryCompiler {
   #table?: string;

   override visitCreateTable(node: CreateTableNode): void {
      this.#table = tableName(node.table);
      try {
         for (const column of node.columns) {
            if (column.autoIncrement) {
               this.append(
                  `create sequence if not exists "${sequenceName(this.#table, column)}"; `,
               );
            }
         }
         super.visitCreateTable(node);
      } finally {
         this.#table = undefined;
      }
   }

   override visitAlterTable(node: AlterTableNode): void {
      this.#table = tableName(node.table);
      try {
         for (const alteration of node.columnAlterations ?? []) {
            if (alteration.kind === "AddColumnNode" && alteration.column.autoIncrement) {
               this.append(
                  `create sequence if not exists "${sequenceName(this.#table, alteration.column)}"; `,
               );
            }
         }
         super.visitAlterTable(node);
      } finally {
         this.#table = undefined;
      }
   }

   /**
    * DuckDB requires constant limits inside correlated subqueries ("non-
    * constant limit not supported"), and kysely always parameterizes
    * limit/offset. Inline numeric values as literals instead — fine for an
    * embedded database with no plan cache.
    */
   override visitLimit(node: LimitNode): void {
      this.append("limit ");
      if (!this.appendImmediate(node.limit)) {
         this.visitNode(node.limit);
      }
   }

   override visitOffset(node: OffsetNode): void {
      this.append("offset ");
      if (!this.appendImmediate(node.offset)) {
         this.visitNode(node.offset);
      }
   }

   private appendImmediate(node: OperationNode): boolean {
      if (node?.kind === "ValueNode") {
         const value = (node as { value?: unknown }).value;
         if (typeof value === "number" || typeof value === "bigint") {
            this.append(String(value));
            return true;
         }
      }
      return false;
   }

   override visitColumnDefinition(node: ColumnDefinitionNode): void {
      this.visitNode(node.column);
      this.append(" ");
      this.visitNode(node.dataType);
      if (node.unsigned) {
         this.append(" unsigned");
      }
      if (node.frontModifiers && node.frontModifiers.length > 0) {
         this.append(" ");
         this.compileList(node.frontModifiers, " ");
      }
      if (node.generated) {
         this.append(" ");
         this.visitNode(node.generated);
      }
      if (node.identity) {
         this.append(" identity");
      }
      if (node.defaultTo) {
         this.append(" ");
         this.visitNode(node.defaultTo);
      }
      if (node.autoIncrement) {
         this.append(` default nextval('${sequenceName(this.#table, node)}')`);
      }
      if (node.notNull) {
         this.append(" not null");
      }
      if (node.unique) {
         this.append(" unique");
      }
      if (node.nullsNotDistinct) {
         this.append(" nulls not distinct");
      }
      if (node.primaryKey) {
         this.append(" primary key");
      }
      if (node.references) {
         this.append(" ");
         this.visitNode(node.references);
      }
      if (node.check) {
         this.append(" ");
         this.visitNode(node.check);
      }
      if (node.endModifiers && node.endModifiers.length > 0) {
         this.append(" ");
         this.compileList(node.endModifiers, " ");
      }
   }
}

function tableName(node: unknown): string {
   if (!node || typeof node !== "object") {
      return "";
   }
   const anyNode = node as Record<string, any>;
   if (anyNode.kind === "TableNode") {
      return identifierName(anyNode.table?.identifier);
   }
   return identifierName(anyNode.identifier ?? node);
}

function identifierName(node: unknown): string {
   if (!node || typeof node !== "object") {
      return "";
   }
   const anyNode = node as Record<string, any>;
   return anyNode.name ?? "";
}

function columnName(node: ColumnDefinitionNode): string {
   const anyColumn = node.column as Record<string, any>;
   return identifierName(anyColumn?.column ?? anyColumn);
}

function sequenceName(table: string | undefined, node: ColumnDefinitionNode): string {
   const sanitized = `${table}_${columnName(node)}`
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/^_+/, "");
   return `seq_${sanitized}`;
}
