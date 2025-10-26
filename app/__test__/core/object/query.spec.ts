import { describe, expect, test } from "bun:test";
import {
   makeValidator,
   exp,
   Expression,
   isPrimitive,
   type Primitive,
} from "../../../src/core/object/query/query";

describe("query", () => {
   test("isPrimitive", () => {
      expect(isPrimitive(1)).toBe(true);
      expect(isPrimitive("1")).toBe(true);
      expect(isPrimitive(true)).toBe(true);
      expect(isPrimitive(false)).toBe(true);

      // not primitives
      expect(isPrimitive(null)).toBe(false);
      expect(isPrimitive(undefined)).toBe(false);
      expect(isPrimitive([])).toBe(false);
      expect(isPrimitive({})).toBe(false);
      expect(isPrimitive(Symbol("test"))).toBe(false);
      expect(isPrimitive(new Date())).toBe(false);
      expect(isPrimitive(new Error())).toBe(false);
      expect(isPrimitive(new Set())).toBe(false);
      expect(isPrimitive(new Map())).toBe(false);
   });

   test("strict expression creation", () => {
      // @ts-expect-error
      expect(() => exp()).toThrow();
      // @ts-expect-error
      expect(() => exp("")).toThrow();
      // @ts-expect-error
      expect(() => exp("invalid")).toThrow();
      // @ts-expect-error
      expect(() => exp("$eq")).toThrow();
      // @ts-expect-error
      expect(() => exp("$eq", 1)).toThrow();
      // @ts-expect-error
      expect(() => exp("$eq", () => null)).toThrow();
      // @ts-expect-error
      expect(() => exp("$eq", () => null, 1)).toThrow();
      expect(
         exp(
            "$eq",
            () => true,
            () => null,
         ),
      ).toBeInstanceOf(Expression);
   });

   test("$eq is required", () => {
      expect(() => makeValidator([])).toThrow();
      expect(() =>
         makeValidator([
            exp(
               "$valid",
               () => true,
               () => null,
            ),
         ]),
      ).toThrow();
      expect(
         makeValidator([
            exp(
               "$eq",
               () => true,
               () => null,
            ),
         ]),
      ).toBeDefined();
   });

   test("validates filter structure", () => {
      const validator = makeValidator([
         exp(
            "$eq",
            (v: Primitive) => isPrimitive(v),
            (e, a) => e === a,
         ),
         exp(
            "$like",
            (v: string) => typeof v === "string",
            (e, a) => e === a,
         ),
      ]);

      // @ts-expect-error intentionally typed as union of given expression keys
      expect(validator.expressionKeys).toEqual(["$eq", "$like"]);

      // @ts-expect-error "$and" is not allowed
      expect(() => validator.convert({ $and: {} })).toThrow();

      // @ts-expect-error "$or" must be an object
      expect(() => validator.convert({ $or: [] })).toThrow();

      // @ts-expect-error "invalid" is not a valid expression key
      expect(() => validator.convert({ foo: { invalid: "bar" } })).toThrow();

      // @ts-expect-error "invalid" is not a valid expression key
      expect(() => validator.convert({ foo: { $invalid: "bar" } })).toThrow();

      // @ts-expect-error "null" is not a valid value
      expect(() => validator.convert({ foo: null })).toThrow();

      // @ts-expect-error only primitives are allowed for $eq
      expect(() => validator.convert({ foo: { $eq: [] } })).toThrow();

      // @ts-expect-error only strings are allowed for $like
      expect(() => validator.convert({ foo: { $like: 1 } })).toThrow();

      // undefined values are ignored
      expect(validator.convert({ foo: undefined })).toEqual({});

      expect(validator.convert({ foo: "bar" })).toEqual({ foo: { $eq: "bar" } });
      expect(validator.convert({ foo: { $eq: "bar" } })).toEqual({ foo: { $eq: "bar" } });
      expect(validator.convert({ foo: { $like: "bar" } })).toEqual({ foo: { $like: "bar" } });
   });
});
