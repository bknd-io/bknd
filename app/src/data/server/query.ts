import { s } from "core/object/schema";
import { WhereBuilder } from "data";
import { $console } from "core";

// -------
// helpers
const stringIdentifier = s.string({
   // allow "id", "id,title" – but not "id," or "not allowed"
   pattern: "^(?:[a-zA-Z_$][\\w$]*)(?:,[a-zA-Z_$][\\w$]*)*$",
});
const numberOrString = <N extends s.NumberSchema>(c: N = {} as N) =>
   s.anyOf([s.number(c), s.string()], {
      coerce: Number,
   });
const stringArray = s.anyOf(
   [
      stringIdentifier,
      s.array(stringIdentifier, {
         uniqueItems: true,
      }),
   ],
   {
      coerce: (v): string[] => {
         if (Array.isArray(v)) {
            return v;
         } else if (typeof v === "string") {
            if (v.includes(",")) {
               return v.split(",");
            }
            return [v];
         }
         return [];
      },
   },
);

// -------
// sorting
const sortDefault = { by: "id", dir: "asc" };
const sortSchema = s.object({
   by: s.string(),
   dir: s.string({ enum: ["asc", "desc"] }).optional(),
});
type SortSchema = s.Static<typeof sortSchema>;
const sort = s.anyOf([s.string(), sortSchema], {
   default: sortDefault,
   coerce: (v): SortSchema => {
      if (typeof v === "string") {
         if (/^-?[a-zA-Z_][a-zA-Z0-9_.]*$/.test(v)) {
            const dir = v[0] === "-" ? "desc" : "asc";
            return { by: dir === "desc" ? v.slice(1) : v, dir } as any;
         } else if (/^{.*}$/.test(v)) {
            return JSON.parse(v) as any;
         }

         $console.warn(`Invalid sort given: '${JSON.stringify(v)}'`);
         return sortDefault as any;
      }
      return v as any;
   },
});

// ------
// filter
const where = s.anyOf([s.string(), s.object({})], {
   coerce: (value: unknown) => {
      const q = typeof value === "string" ? JSON.parse(value) : value;
      return WhereBuilder.convert(q);
   },
});
type WhereSchemaIn = s.Static<typeof where>;
type WhereSchema = s.StaticCoersed<typeof where>;

// ------
// with
const withSchema = s.anyOf(
   [stringIdentifier, s.array(stringIdentifier), s.refId("query-schema") /*s.record({})*/],
   {
      /*coerce: (value: unknown): any => {
         console.log(value);
         return value;
      },*/
   },
);

// ==========
// REPO QUERY
export const repoQuery = s.partialObject(
   {
      limit: numberOrString({ default: 10 }),
      offset: numberOrString({ default: 0 }),
      sort,
      where,
      select: stringArray,
      join: stringArray,
      with: withSchema,
   },
   {
      $id: "query-schema",
   },
);
type RepoQueryIn = s.Static<typeof repoQuery>;
type RepoQuery = s.StaticCoersed<typeof repoQuery>;
