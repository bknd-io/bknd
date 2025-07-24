import {
   type AliasableExpression,
   type ColumnBuilderCallback,
   type ColumnDataType,
   type Compilable,
   type CompiledQuery,
   type DatabaseIntrospector,
   type Dialect,
   type Expression,
   type Kysely,
   type KyselyPlugin,
   type OnModifyForeignAction,
   type QueryResult,
   type RawBuilder,
   type SelectQueryBuilder,
   type SelectQueryNode,
   type Simplify,
   sql,
} from "kysely";
import type { BaseIntrospector, BaseIntrospectorConfig } from "./BaseIntrospector";
import type { Constructor, DB } from "core";
import { KyselyPluginRunner } from "data/plugins/KyselyPluginRunner";
import type { Field } from "data/fields/Field";

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

export type ConnQuery = CompiledQuery | Compilable;

export type ConnQueryResult<T extends ConnQuery> = T extends CompiledQuery<infer R>
   ? QueryResult<R>
   : T extends Compilable<infer R>
     ? QueryResult<R>
     : never;

export type ConnQueryResults<T extends ConnQuery[]> = {
   [K in keyof T]: ConnQueryResult<T[K]>;
};

const CONN_SYMBOL = Symbol.for("bknd:connection");

export type Features = {
   batching: boolean;
   softscans: boolean;
};

export abstract class Connection<Client = unknown> {
   abstract name: string;
   protected initialized = false;
   protected pluginRunner: KyselyPluginRunner;
   protected readonly supported: Partial<Features> = {
      batching: false,
      softscans: true,
   };
   kysely: Kysely<DB>;
   client!: Client;

   constructor(
      kysely: Kysely<any>,
      public fn: Partial<DbFunctions> = {},
      protected plugins: KyselyPlugin[] = [],
   ) {
      this.kysely = kysely;
      this[CONN_SYMBOL] = true;
      this.pluginRunner = new KyselyPluginRunner(plugins);
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

   protected async transformResultRows(result: any[]): Promise<any[]> {
      return await this.pluginRunner.transformResultRows(result);
   }

   /**
    * Execute a query and return the result including all metadata
    * returned from the dialect.
    */
   async executeQueries<O extends ConnQuery[]>(...qbs: O): Promise<ConnQueryResults<O>> {
      return Promise.all(qbs.map(async (qb) => await this.kysely.executeQuery(qb))) as any;
   }

   async executeQuery<O extends ConnQuery>(qb: O): Promise<ConnQueryResult<O>> {
      const res = await this.executeQueries(qb);
      return res[0] as any;
   }

   protected getCompiled(...qbs: ConnQuery[]): CompiledQuery[] {
      return qbs.map((qb) => {
         if ("compile" in qb) {
            return qb.compile();
         }
         return qb;
      });
   }

   protected async withTransformedRows<
      Key extends string = "rows",
      O extends { [K in Key]: any[] }[] = [],
   >(result: O, _key?: Key): Promise<O> {
      return (await Promise.all(
         result.map(async (row) => {
            const key = _key ?? "rows";
            const { [key]: rows, ...r } = row;
            return {
               ...r,
               rows: await this.transformResultRows(rows),
            };
         }),
      )) as any;
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

   toDriver(value: unknown, field: Field): unknown {
      return value;
   }

   fromDriver(value: any, field: Field): unknown {
      return value;
   }

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
