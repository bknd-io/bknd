import type { PrimaryFieldType } from "core/config";

export type Primitive = PrimaryFieldType | string | number | boolean;
export function isPrimitive(value: any): value is Primitive {
   return ["string", "number", "boolean"].includes(typeof value);
}
export type BooleanLike = boolean | 0 | 1;
export function isBooleanLike(value: any): value is boolean {
   return [true, false, 0, 1].includes(value);
}

export class Expression<Key, Expect = unknown, CTX = any> {
   expect!: Expect;

   constructor(
      public key: Key,
      public valid: (v: Expect) => boolean,
      public validate: (e: any, a: any, ctx: CTX) => any,
   ) {}
}
export type TExpression<Key, Expect = unknown, CTX = any> = Expression<Key, Expect, CTX>;

export function exp<const Key, const Expect, CTX = any>(
   key: Key,
   valid: (v: Expect) => boolean,
   validate: (e: Expect, a: unknown, ctx: CTX) => any,
): Expression<Key, Expect, CTX> {
   return new Expression(key, valid, validate);
}

type Expressions = Expression<any, any>[];
type ExpressionMap<Exps extends Expressions> = {
   [K in Exps[number]["key"]]: Extract<Exps[number], { key: K }> extends Expression<K, infer E>
      ? E
      : never;
};
type ExpressionKeys<Exps extends Expressions> = Exps[number]["key"];

type ExpressionCondition<Exps extends Expressions> = {
   [K in keyof ExpressionMap<Exps>]: { [P in K]: ExpressionMap<Exps>[K] };
}[keyof ExpressionMap<Exps>];

function getExpression<Exps extends Expressions>(
   expressions: Exps,
   key: string,
): Expression<any, any> {
   const exp = expressions.find((e) => e.key === key);
   if (!exp) throw new Error(`Expression does not exist: "${key}"`);
   return exp as any;
}

type LiteralExpressionCondition<Exps extends Expressions> = {
   [key: string]: Primitive | ExpressionCondition<Exps>;
};

const OperandOr = "$or" as const;
type OperandCondition<Exps extends Expressions> = {
   [OperandOr]?: LiteralExpressionCondition<Exps> | ExpressionCondition<Exps>;
};

export type FilterQuery<Exps extends Expressions> =
   | LiteralExpressionCondition<Exps>
   | OperandCondition<Exps>;

function _convert<Exps extends Expressions>(
   $query: FilterQuery<Exps>,
   expressions: Exps,
   path: string[] = [],
): FilterQuery<Exps> {
   const ExpressionConditionKeys = expressions.map((e) => e.key);
   const keys = Object.keys($query);
   const operands = [OperandOr] as const;
   const newQuery: FilterQuery<Exps> = {};

   if (keys.some((k) => k.startsWith("$") && !operands.includes(k as any))) {
      throw new Error(`Invalid key '${keys}'. Keys must not start with '$'.`);
   }

   if (path.length > 0 && keys.some((k) => operands.includes(k as any))) {
      throw new Error(`Operand ${OperandOr} can only appear at the top level.`);
   }

   function validate(key: string, value: any, path: string[] = []) {
      const exp = getExpression(expressions, key as any);
      if (exp.valid(value) === false) {
         throw new Error(`Invalid value at "${[...path, key].join(".")}": ${value}`);
      }
   }

   for (const [key, value] of Object.entries($query)) {
      // if $or, convert each value
      if (key === "$or") {
         newQuery.$or = _convert(value, expressions, [...path, key]);

         // if primitive, assume $eq
      } else if (isPrimitive(value)) {
         validate("$eq", value, path);
         newQuery[key] = { $eq: value };

         // if object, check for expressions
      } else if (typeof value === "object") {
         // when object is given, check if all keys are expressions
         const invalid = Object.keys(value).filter(
            (f) => !ExpressionConditionKeys.includes(f as any),
         );
         if (invalid.length === 0) {
            newQuery[key] = {};
            // validate each expression
            for (const [k, v] of Object.entries(value)) {
               validate(k, v, [...path, key]);
               newQuery[key][k] = v;
            }
         } else {
            throw new Error(
               `Invalid key(s) at "${key}": ${invalid.join(", ")}. Expected expressions.`,
            );
         }
      }
   }

   return newQuery;
}

type ValidationResults = { $and: any[]; $or: any[]; keys: Set<string> };
type BuildOptions = {
   object?: any;
   exp_ctx?: any;
   convert?: boolean;
   value_is_kv?: boolean;
};
function _build<Exps extends Expressions>(
   _query: FilterQuery<Exps>,
   expressions: Exps,
   options: BuildOptions,
): ValidationResults {
   const $query = options.convert ? _convert<Exps>(_query, expressions) : _query;

   const result: ValidationResults = {
      $and: [],
      $or: [],
      keys: new Set<string>(),
   };

   const { $or, ...$and } = $query;

   function __validate($op: string, expected: any, actual: any, path: string[] = []) {
      const exp = getExpression(expressions, $op as any);
      if (!exp) {
         throw new Error(`Expression does not exist: "${$op}"`);
      }
      if (!exp.valid(expected)) {
         throw new Error(`Invalid expected value at "${[...path, $op].join(".")}": ${expected}`);
      }
      return exp.validate(expected, actual, options.exp_ctx);
   }

   // check $and
   for (const [key, value] of Object.entries($and)) {
      for (const [$op, $v] of Object.entries(value)) {
         const objValue = options.value_is_kv ? key : options.object[key];
         result.$and.push(__validate($op, $v, objValue, [key]));
         result.keys.add(key);
      }
   }

   // check $or
   for (const [key, value] of Object.entries($or ?? {})) {
      const objValue = options.value_is_kv ? key : options.object[key];

      for (const [$op, $v] of Object.entries(value)) {
         result.$or.push(__validate($op, $v, objValue, [key]));
         result.keys.add(key);
      }
   }

   return result;
}

function _validate(results: ValidationResults): boolean {
   const matches: { $and?: boolean; $or?: boolean } = {
      $and: undefined,
      $or: undefined,
   };

   matches.$and = results.$and.every((r) => Boolean(r));
   matches.$or = results.$or.some((r) => Boolean(r));

   return !!matches.$and || !!matches.$or;
}

export function makeValidator<Exps extends Expressions>(expressions: Exps) {
   return {
      convert: (query: FilterQuery<Exps>) => _convert(query, expressions),
      build: (query: FilterQuery<Exps>, options: BuildOptions) =>
         _build(query, expressions, options),
      validate: (query: FilterQuery<Exps>, options: BuildOptions) => {
         const fns = _build(query, expressions, options);
         return _validate(fns);
      },
      expressions,
      expressionKeys: expressions.map((e) => e.key) as ExpressionKeys<Exps>,
   };
}
