import {
   type BooleanLike,
   type FilterQuery,
   type Primitive,
   exp,
   isBooleanLike,
   isPrimitive,
   makeValidator,
} from "core/object/query/query";
import type {
   DeleteQueryBuilder,
   ExpressionBuilder,
   ExpressionWrapper,
   SelectQueryBuilder,
   UpdateQueryBuilder,
} from "kysely";

type Builder = ExpressionBuilder<any, any>;
type Wrapper = ExpressionWrapper<any, any, any>;
type WhereQb =
   | SelectQueryBuilder<any, any, any>
   | UpdateQueryBuilder<any, any, any, any>
   | DeleteQueryBuilder<any, any, any>;

function key(e: unknown): string {
   if (typeof e !== "string") {
      throw new Error(`Invalid key: ${e}`);
   }
   return e as string;
}

const expressions = [
   exp(
      "$eq",
      (v: Primitive) => isPrimitive(v),
      (v, k, eb: Builder) => eb(key(k), "=", v),
   ),
   exp(
      "$ne",
      (v: Primitive) => isPrimitive(v),
      (v, k, eb: Builder) => eb(key(k), "!=", v),
   ),
   exp(
      "$gt",
      (v: Primitive) => isPrimitive(v),
      (v, k, eb: Builder) => eb(key(k), ">", v),
   ),
   exp(
      "$gte",
      (v: Primitive) => isPrimitive(v),
      (v, k, eb: Builder) => eb(key(k), ">=", v),
   ),
   exp(
      "$lt",
      (v: Primitive) => isPrimitive(v),
      (v, k, eb: Builder) => eb(key(k), "<", v),
   ),
   exp(
      "$lte",
      (v: Primitive) => isPrimitive(v),
      (v, k, eb: Builder) => eb(key(k), "<=", v),
   ),
   exp(
      "$isnull",
      (v: BooleanLike) => isBooleanLike(v),
      (v, k, eb: Builder) => eb(key(k), v ? "is" : "is not", null),
   ),
   exp(
      "$in",
      (v: any[]) => Array.isArray(v),
      (v, k, eb: Builder) => eb(key(k), "in", v),
   ),
   exp(
      "$notin",
      (v: any[]) => Array.isArray(v),
      (v, k, eb: Builder) => eb(key(k), "not in", v),
   ),
   exp(
      "$between",
      (v: [number, number]) => Array.isArray(v) && v.length === 2,
      (v, k, eb: Builder) => eb.between(key(k), v[0], v[1]),
   ),
   exp(
      "$like",
      (v: Primitive) => isPrimitive(v),
      (v, k, eb: Builder) => eb(key(k), "like", String(v).replace(/\*/g, "%")),
   ),
];

export type WhereQuery = FilterQuery<typeof expressions>;

const validator = makeValidator(expressions);
export const expressionKeys = validator.expressionKeys;

export class WhereBuilder {
   static addClause<QB extends WhereQb>(qb: QB, query: WhereQuery) {
      if (Object.keys(query).length === 0) {
         return qb;
      }

      // @ts-ignore
      return qb.where((eb) => {
         const fns = validator.build(query, {
            value_is_kv: true,
            exp_ctx: eb,
            convert: true,
         });

         if (fns.$or.length > 0 && fns.$and.length > 0) {
            return eb.and(fns.$and).or(eb.and(fns.$or));
         } else if (fns.$or.length > 0) {
            return eb.or(fns.$or);
         }

         return eb.and(fns.$and);
      });
   }

   static convert(query: WhereQuery): WhereQuery {
      return validator.convert(query);
   }

   static getPropertyNames(query: WhereQuery): string[] {
      const { keys } = validator.build(query, {
         value_is_kv: true,
         exp_ctx: () => null,
         convert: true,
      });
      return Array.from(keys);
   }
}
