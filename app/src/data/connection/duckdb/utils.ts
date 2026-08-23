import { blobValue, timestampValue } from "@duckdb/node-api";

const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

export function isSafeBigint(value: bigint): boolean {
   return value >= MIN_SAFE && value <= MAX_SAFE;
}

/**
 * kysely parameters may contain JS values that @duckdb/node-api cannot infer
 * a DuckDB type for (plain `Date`, `Uint8Array`) or that we want normalized
 * (bigint within safe integer range).
 */
export function toDuckdbParam(value: unknown): unknown {
   if (value === undefined) {
      return null;
   }
   if (value instanceof Date) {
      return timestampValue(BigInt(Math.round(value.getTime() * 1000)));
   }
   if (value instanceof Uint8Array) {
      return blobValue(value);
   }
   if (typeof value === "bigint" && isSafeBigint(value)) {
      return Number(value);
   }
   return value;
}

/** DuckDB returns bigint for BIGINT/HUGEINT columns; bknd expects JS numbers. */
export function fromDuckdbValue(value: unknown): unknown {
   if (typeof value === "bigint" && isSafeBigint(value)) {
      return Number(value);
   }
   return value;
}

export function convertRow(row: Record<string, unknown>): Record<string, unknown> {
   const out: Record<string, unknown> = {};
   for (const key in row) {
      out[key] = fromDuckdbValue(row[key]);
   }
   return out;
}

/**
 * Parse a `duckdb_indexes().expressions` value into column names. Plain column
 * indexes report like `[a, b]` (or `['"a"']` when the DDL used quoted
 * identifiers); expression indexes report quoted SQL like `['(lower(b))']` and
 * are excluded.
 */
export function parseIndexColumns(expressions: unknown): string[] {
   if (typeof expressions !== "string") {
      return [];
   }
   let list = expressions.trim();
   if (list.startsWith("[") && list.endsWith("]")) {
      list = list.slice(1, -1);
   }
   return list
      .split(",")
      .map((part) => {
         let entry = part.trim();
         if (/^'.*'$/.test(entry)) {
            entry = entry.slice(1, -1).trim();
         }
         if (/^".*"$/.test(entry)) {
            entry = entry.slice(1, -1);
         }
         return entry;
      })
      .filter((name) => /^[A-Za-z_][\w ]*$/.test(name));
}
