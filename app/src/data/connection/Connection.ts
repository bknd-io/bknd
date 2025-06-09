import {
   type AliasableExpression,
   type ColumnBuilderCallback,
   type ColumnDataType,
   type DatabaseIntrospector,
   type Dialect,
   type Expression,
   type Kysely,
   type KyselyPlugin,
   type OnModifyForeignAction,
   type RawBuilder,
   type SelectQueryBuilder,
   type SelectQueryNode,
   type Simplify,
   sql,
} from "kysely";
import type { BaseIntrospector, BaseIntrospectorConfig } from "./BaseIntrospector";
import type { Constructor } from "core";

export type QB = SelectQueryBuilder<any, any, any>;

export type IndexMetadata = {
   name: string;
   table: string;
   isUnique: boolean;
   columns: { name: string; order: number }[];
};

export interface SelectQueryBuilderExpression<O> extends AliasableExpression<O> {
   get isSelectQueryBuilder(): true;
   toOperationNode(): SelectQueryNode;
}

export type SchemaResponse = [string, ColumnDataType, ColumnBuilderCallback] | undefined;

const FieldSpecTypes = [
   "text",
   "integer",
   "real",
   "blob",
   "date",
   "datetime",
   "timestamp",
   "boolean",
   "json",
] as const;

export type FieldSpec = {
   type: (typeof FieldSpecTypes)[number];
   name: string;
   nullable?: boolean;
   dflt?: any;
   unique?: boolean;
   primary?: boolean;
   references?: string;
   onDelete?: OnModifyForeignAction;
   onUpdate?: OnModifyForeignAction;
};

export type IndexSpec = {
   name: string;
   columns: string[];
   unique?: boolean;
};

export type DbFunctions = {
   jsonObjectFrom<O>(expr: SelectQueryBuilderExpression<O>): RawBuilder<Simplify<O> | null>;
   jsonArrayFrom<O>(expr: SelectQueryBuilderExpression<O>): RawBuilder<Simplify<O>[]>;
   jsonBuildObject<O extends Record<string, Expression<unknown>>>(
      obj: O,
   ): RawBuilder<
      Simplify<{
         [K in keyof O]: O[K] extends Expression<infer V> ? V : never;
      }>
   >;
};

const CONN_SYMBOL = Symbol.for("bknd:connection");

export abstract class Connection<DB = any> {
   protected initialized = false;
   kysely: Kysely<DB>;
   protected readonly supported = {
      batching: false,
      counts: true,
   };

   constructor(
      kysely: Kysely<DB>,
      public fn: Partial<DbFunctions> = {},
      protected plugins: KyselyPlugin[] = [],
   ) {
      this.kysely = kysely;
      this[CONN_SYMBOL] = true;
   }

   // @todo: consider moving constructor logic here, required by sqlocal
   async init(): Promise<void> {
      this.initialized = true;
   }

   /**
    * This is a helper function to manage Connection classes
    * coming from different places
    * @param conn
    */
   static isConnection(conn: unknown): conn is Connection {
      if (!conn) return false;
      return conn[CONN_SYMBOL] === true;
   }

   getIntrospector(): BaseIntrospector {
      return this.kysely.introspection as any;
   }

   supports(feature: keyof typeof this.supported): boolean {
      return this.supported[feature] ?? false;
   }

   async ping(): Promise<boolean> {
      const res = await sql`SELECT 1`.execute(this.kysely);
      return res.rows.length > 0;
   }

   protected async batch<Queries extends QB[]>(
      queries: [...Queries],
   ): Promise<{
      [K in keyof Queries]: Awaited<ReturnType<Queries[K]["execute"]>>;
   }> {
      throw new Error("Batching not supported");
   }

   async batchQuery<Queries extends QB[]>(
      queries: [...Queries],
   ): Promise<{
      [K in keyof Queries]: Awaited<ReturnType<Queries[K]["execute"]>>;
   }> {
      // bypass if no client support
      if (!this.supports("batching")) {
         const data: any = [];
         for (const q of queries) {
            const result = await q.execute();
            data.push(result);
         }
         return data;
      }

      return await this.batch(queries);
   }

   protected validateFieldSpecType(type: string): type is FieldSpec["type"] {
      if (!FieldSpecTypes.includes(type as any)) {
         throw new Error(
            `Invalid field type "${type}". Allowed types are: ${FieldSpecTypes.join(", ")}`,
         );
      }
      return true;
   }

   abstract getFieldSchema(spec: FieldSpec, strict?: boolean): SchemaResponse;

   async close(): Promise<void> {
      // no-op by default
   }
}

export function customIntrospector<T extends Constructor<Dialect>>(
   dialect: T,
   introspector: Constructor<DatabaseIntrospector>,
   options: BaseIntrospectorConfig = {},
) {
   return {
      create(...args: ConstructorParameters<T>) {
         return new (class extends dialect {
            override createIntrospector(db: Kysely<any>): DatabaseIntrospector {
               return new introspector(db, options);
            }
         })(...args);
      },
   };
}
