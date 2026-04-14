import { describe, test, expect } from "bun:test";
import { s, parse as schemaParse } from "bknd/utils";
import { WhereBuilder } from "data/entities/query/WhereBuilder";
import { repoQuery } from "data/server/query";
import { mergeFilters } from "auth/authorize/Guard";

describe("issue #391: end-to-end flow", () => {
   test("full request flow: query param → repoQuery → mergeFilters → WhereBuilder", () => {
      // Step 1: Hono receives query params
      const rawQueryParams = {
         where: '{"created_at":{"$gte":"2024-01-01","$lte":"2024-12-31"}}',
         limit: "10",
      };

      // Step 2: jsc validates/coerces against repoQuery
      const options = schemaParse(repoQuery, rawQueryParams);
      expect(options.where).toEqual({
         created_at: { $gte: "2024-01-01", $lte: "2024-12-31" },
      });

      // Step 3: permission middleware calls merge() which uses mergeFilters
      const mergedWhere = mergeFilters(options.where, {});
      expect(mergedWhere.created_at.$gte).toBe("2024-01-01");
      expect(mergedWhere.created_at.$lte).toBe("2024-12-31");

      // Step 4: WhereBuilder.addClause() builds the SQL
      const converted = WhereBuilder.convert(mergedWhere);
      expect(converted).toEqual({
         created_at: { $gte: "2024-01-01", $lte: "2024-12-31" },
      });
   });

   test("full flow with policy filter involved", () => {
      const rawQueryParams = {
         where: '{"created_at":{"$gte":"2024-06-01"}}',
      };
      const policyFilter = { status: "published" };

      const options = schemaParse(repoQuery, rawQueryParams);
      const mergedWhere = mergeFilters(options.where, policyFilter);

      console.log("merged:", JSON.stringify(mergedWhere, null, 2));
      expect(mergedWhere.created_at.$gte).toBe("2024-06-01");
      expect(mergedWhere.status.$eq).toBe("published");
   });
});
