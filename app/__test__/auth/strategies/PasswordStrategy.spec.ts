import { PasswordStrategy } from "auth/authenticate/strategies/PasswordStrategy";
import { describe, expect, it } from "bun:test";

describe("PasswordStrategy", () => {
   it("should enforce provided minimum length", async () => {
      const strategy = new PasswordStrategy({ minLength: 8, hashing: "plain" });

      expect(strategy.verify("password")({} as any)).rejects.toThrow();
      expect(
         strategy.verify("password1234")({ strategy_value: "password1234" } as any),
      ).resolves.toBeUndefined();
   });
});
