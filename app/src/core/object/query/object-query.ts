import {
   type FilterQuery,
   type Primitive,
   exp,
   isPrimitive,
   makeValidator,
} from "./query";

const expressions = [
   exp(
      "$eq",
      (v: Primitive) => isPrimitive(v),
      (e, a) => e === a,
   ),
   exp(
      "$ne",
      (v: Primitive) => isPrimitive(v),
      (e, a) => e !== a,
   ),
   exp(
      "$like",
      (v: Primitive) => isPrimitive(v),
      (e, a) => {
         switch (typeof a) {
            case "string":
               return (a as string).includes(e as string);
            case "number":
               return (a as number) === Number(e);
            case "boolean":
               return (a as boolean) === Boolean(e);
            default:
               return false;
         }
      },
   ),
   exp(
      "$regex",
      (v: RegExp | string) => (v instanceof RegExp ? true : typeof v === "string"),
      (e: any, a: any) => {
         if (e instanceof RegExp) {
            return e.test(a);
         }
         if (typeof e === "string") {
            const regex = new RegExp(e);
            return regex.test(a);
         }
         return false;
      },
   ),
   exp(
      "$isnull",
      (v: boolean | 1 | 0) => true,
      (e, a) => (e ? a === null : a !== null),
   ),
   exp(
      "$notnull",
      (v: boolean | 1 | 0) => true,
      (e, a) => (e ? a !== null : a === null),
   ),
   exp(
      "$in",
      (v: (string | number)[]) => Array.isArray(v),
      (e: any, a: any) => e.includes(a),
   ),
   exp(
      "$notin",
      (v: (string | number)[]) => Array.isArray(v),
      (e: any, a: any) => !e.includes(a),
   ),
   exp(
      "$gt",
      (v: Primitive) => isPrimitive(v),
      (e: any, a: any) => a > e,
   ),
   exp(
      "$gte",
      (v: Primitive) => isPrimitive(v),
      (e: any, a: any) => a >= e,
   ),
   exp(
      "$lt",
      (v: Primitive) => isPrimitive(v),
      (e: any, a: any) => a < e,
   ),
   exp(
      "$lte",
      (v: Primitive) => isPrimitive(v),
      (e: any, a: any) => a <= e,
   ),
   exp(
      "$between",
      (v: [Primitive, Primitive]) =>
         Array.isArray(v) && v.length === 2 && v.every((n) => isPrimitive(n)),
      (e: any, a: any) => e[0] <= a && a <= e[1],
   ),
];

export type ObjectQuery = FilterQuery<typeof expressions>;
const validator = makeValidator(expressions);
export const convert = (query: ObjectQuery) => validator.convert(query);
export const validate = (query: ObjectQuery, object: Record<string, any>) =>
   validator.validate(query, { object, convert: true });
