import { describe, test, expect } from "bun:test";
import { convert as oqConvert, validate as oqValidate, type ObjectQuery } from "core/object/query/object-query";
import { WhereBuilder, expressionKeys as wbKeys } from "data/entities/query/WhereBuilder";
import { mergeFilters } from "auth/authorize/Guard";
import { Policy } from "auth/authorize/Policy";

// ─────────────────────────────────────────────────
// GAP ANALYSIS: Operators in object-query but missing from WhereBuilder
// Any such gap means: policy filter passes permission validation → 
// merges with user where → crashes when WhereBuilder converts to SQL
// ─────────────────────────────────────────────────

describe("INTENTIONAL GAP: $regex only in object-query (SQLite doesn't support regex)", () => {
   test("object-query accepts $regex (string)", () => {
      expect(() => oqConvert({ email: { $regex: "@company\\.com$" } })).not.toThrow();
   });

   test("WhereBuilder REJECTS $regex — by design (no SQL equivalent in SQLite)", () => {
      expect(() => WhereBuilder.convert({ email: { $regex: "@company\\.com$" } })).toThrow(
         /Invalid key.*\$regex/,
      );
   });

   test("$regex still works for in-memory Policy filter validation", () => {
      const policy = new Policy({
         description: "only company emails",
         filter: { email: { $regex: "@company\\.com$" } },
      });

      expect(policy.meetsFilter({ email: "user@company.com" })).toBe(true);
      expect(policy.meetsFilter({ email: "user@gmail.com" })).toBe(false);
   });

   test("policy $regex filter would crash if used in a WHERE clause that hits SQL", () => {
      // This documents the known limitation: policy filters using $regex
      // cannot be used in permissions that need to translate to SQL WHERE clauses.
      // Use $like instead for SQL-compatible pattern matching.
      const merged = mergeFilters({}, { email: { $regex: "@company\\.com$" } });
      expect(() => WhereBuilder.convert(merged)).toThrow(/Invalid key.*\$regex/);
   });

   test("$regex with RegExp object in object-query", () => {
      expect(() => oqConvert({ name: { $regex: /^test/ } })).not.toThrow();
   });
});

describe("FIXED: $notnull — now present in both systems", () => {
   test("object-query accepts $notnull", () => {
      expect(() => oqConvert({ deleted_at: { $notnull: true } })).not.toThrow();
   });

   test("WhereBuilder accepts $notnull (fixed)", () => {
      expect(() => WhereBuilder.convert({ deleted_at: { $notnull: true } })).not.toThrow();
   });

   test("policy filter with $notnull works end-to-end", () => {
      const policy = new Policy({
         description: "only non-deleted",
         filter: { deleted_at: { $notnull: true } },
      });

      expect(policy.meetsFilter({ deleted_at: "2024-01-01" })).toBe(true);
      expect(policy.meetsFilter({ deleted_at: null })).toBe(false);

      const merged = mergeFilters({}, policy.getReplacedFilter({}));
      expect(() => WhereBuilder.convert(merged)).not.toThrow();
   });
});

// ─────────────────────────────────────────────────
// EDGE CASES: Type mismatches between systems
// ─────────────────────────────────────────────────

describe("EDGE: $between type annotation mismatch in WhereBuilder", () => {
   test("WhereBuilder $between validator accepts non-number arrays", () => {
      // The validator is: Array.isArray(v) && v.length === 2
      // It doesn't check element types — strings pass through
      expect(() =>
         WhereBuilder.convert({ created_at: { $between: ["2024-01-01", "2024-12-31"] } }),
      ).not.toThrow();
   });

   test("object-query $between with strings should also work", () => {
      expect(() =>
         oqConvert({ created_at: { $between: ["2024-01-01", "2024-12-31"] } }),
      ).not.toThrow();
   });
});

describe("EDGE: $in/$notin with non-string/non-number values", () => {
   test("object-query $in with booleans", () => {
      // Validator: Array.isArray — accepts any array
      expect(() => oqConvert({ active: { $in: [true, false] } })).not.toThrow();
   });

   test("WhereBuilder $in with booleans", () => {
      expect(() => WhereBuilder.convert({ active: { $in: [true, false] } })).not.toThrow();
   });
});

describe("EDGE: $isnull validator consistency", () => {
   test("object-query $isnull with 0/1", () => {
      expect(() => oqConvert({ x: { $isnull: 1 } })).not.toThrow();
      expect(() => oqConvert({ x: { $isnull: 0 } })).not.toThrow();
   });

   test("object-query $isnull with boolean", () => {
      expect(() => oqConvert({ x: { $isnull: true } })).not.toThrow();
      expect(() => oqConvert({ x: { $isnull: false } })).not.toThrow();
   });

   test("WhereBuilder $isnull with 0/1", () => {
      expect(() => WhereBuilder.convert({ x: { $isnull: 1 } })).not.toThrow();
      expect(() => WhereBuilder.convert({ x: { $isnull: 0 } })).not.toThrow();
   });

   test("WhereBuilder $isnull with boolean", () => {
      expect(() => WhereBuilder.convert({ x: { $isnull: true } })).not.toThrow();
      expect(() => WhereBuilder.convert({ x: { $isnull: false } })).not.toThrow();
   });
});

describe("EDGE: mergeFilters with $or and string comparisons", () => {
   test("$or with $gte string values", () => {
      const userWhere = {
         $or: { status: { $eq: "published" }, created_at: { $gte: "2024-01-01" } },
      };
      const merged = mergeFilters(userWhere, {});
      expect(merged.$or.status).toEqual({ $eq: "published" });
      expect(merged.$or.created_at).toEqual({ $gte: "2024-01-01" });
   });
});

describe("EDGE: empty and edge case queries", () => {
   test("empty object where", () => {
      expect(() => oqConvert({})).not.toThrow();
      expect(() => WhereBuilder.convert({})).not.toThrow();
   });

   test("$in with empty array", () => {
      expect(() => oqConvert({ status: { $in: [] } })).not.toThrow();
      expect(() => WhereBuilder.convert({ status: { $in: [] } })).not.toThrow();
   });
});
